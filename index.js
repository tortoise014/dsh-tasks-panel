/**
 * dsh-tasks-panel — host half.
 *
 * Owns the persisted store (storageDomain) and serves the browser half over
 * `/api/dsh-tasks-panel/op`. The agent-facing `task_write` tool calls exactly the
 * same operations as the UI, so the panel and the agent can never diverge.
 */
import { createHmac, randomUUID } from 'node:crypto'
import { z } from 'zod'

export const name = 'dsh-tasks-panel'
export const inject = ['storageDomain', 'connection', 'tools']

const ROUTE = '/api/dsh-tasks-panel/op'
const MAX_BODY = 1 << 20

const DateString = z.string().nullable()
// `nullish` keeps records written before the field existed readable.
const ClockString = z.string().nullish()

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  note: z.string().nullable(),
  due: DateString,
  time: ClockString,
  status: z.enum(['open', 'done']),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: DateString,
  source: z.enum(['user', 'agent']),
  sessionId: z.string().nullable(),
  // `${due}T${time}` that was already pushed, so a reminder fires once per slot.
  notifiedFor: z.string().nullish(),
  notifiedAt: z.string().nullish(),
})

const EventSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  title: z.string(),
  kind: z.enum(['created', 'completed', 'reopened', 'updated', 'deleted']),
  at: z.string(),
  due: DateString,
  time: ClockString,
})

const SettingsSchema = z.object({
  enabled: z.boolean(),
  webhook: z.string(),
  secret: z.string(),
  // Whether the first-run guide was already shown and dismissed.
  onboarded: z.boolean().nullish(),
})

const SPEC = {
  // Storage unit names must match /^[a-z][a-z0-9_]*$/ (no dashes).
  name: 'dsh_tasks',
  version: 1,
  layout: 'single',
  invalidRecords: 'backup-and-skip',
  global: {
    schema: SettingsSchema,
    initial: { enabled: false, webhook: '', secret: '', onboarded: false },
  },
  tables: {
    tasks: { valueSchema: TaskSchema },
    events: { valueSchema: EventSchema },
  },
}

/** 'YYYY-MM-DD', or null when the value is not a plain calendar date. */
function normalizeDue(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

/** 'HH:mm' in 24h form, or null; throws when the text is present but unusable. */
function normalizeTime(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(text)
  if (!match) throw new Error(`time must look like HH:mm, got "${text}"`)
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) throw new Error(`time out of range: "${text}"`)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function textOrNull(value, limit) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, limit)
}

/**
 * Reminders only fire for tasks that carry BOTH a date and a clock: a bare date
 * is a to-do for the day, not an appointment. Sets without a clock are silent
 * by design (the panel calls that out in its hint text).
 */
const CLOCK_GRACE_MS = 6 * 60 * 60 * 1000
const TICK_MS = 30 * 1000

function dueAt(task) {
  if (!task.due || !task.time) return null
  const [year, month, day] = task.due.split('-').map(Number)
  const [hours, minutes] = task.time.split(':').map(Number)
  if (!year || !month || !day) return null
  const when = new Date(year, month - 1, day, hours, minutes, 0, 0)
  const at = when.getTime()
  return Number.isFinite(at) ? at : null
}

function slotOf(task) {
  return `${task.due}T${task.time}`
}

function reminderText(task) {
  const lines = [`⏰ ${task.title}`]
  lines.push(`时间 ${task.due} ${task.time}`)
  if (task.note) lines.push(`备注 ${task.note}`)
  if (task.source === 'agent') lines.push('来源：助手')
  return lines.join('\n')
}

function normalizeWebhook(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return ''
  if (!/^https?:\/\/\S+$/i.test(text)) throw new Error('webhook must be an http(s) URL')
  if (text.length > 400) throw new Error('webhook is too long')
  return text
}

/** Posts plain text to a Feishu group custom bot, signing when a secret is set. */
async function postFeishu(settings, text) {
  const url = normalizeWebhook(settings.webhook)
  if (!url) throw new Error('no Feishu webhook configured')
  const payload = { msg_type: 'text', content: { text } }
  if (settings.secret) {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const sign = createHmac('sha256', `${timestamp}\n${settings.secret}`).update('').digest('base64')
    payload.timestamp = timestamp
    payload.sign = sign
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`Feishu HTTP ${response.status}: ${body.slice(0, 200)}`)
  let parsed = null
  try {
    parsed = JSON.parse(body)
  } catch {
    parsed = null
  }
  const code = parsed ? (parsed.code ?? parsed.StatusCode ?? 0) : 0
  if (code !== 0) {
    const message = (parsed && (parsed.msg || parsed.StatusMessage)) || body.slice(0, 200)
    throw new Error(`Feishu rejected the message: ${message}`)
  }
  return true
}

function maskWebhook(value) {
  const text = typeof value === 'string' ? value : ''
  if (!text) return ''
  const tail = text.slice(-6)
  return `${text.split('/').slice(0, 3).join('/')}/…/${tail}`
}

function createOps(ctx) {
  let opened = null
  const domain = () => {
    if (!opened) opened = ctx.storageDomain.open(SPEC)
    return opened
  }

  const tasks = async () => (await domain()).table('tasks')
  const events = async () => (await domain()).table('events')

  async function appendEvent(task, kind, at) {
    const record = {
      id: `e_${randomUUID()}`,
      taskId: task.id,
      title: task.title,
      kind,
      at,
      due: task.due,
      time: task.time ?? null,
    }
    await (await events()).put(record.id, record)
    return record
  }

  async function requireTask(id) {
    const table = await tasks()
    const found = typeof id === 'string' ? table.get(id) : undefined
    if (!found) throw new Error(`unknown task: ${id}`)
    return { table, task: found }
  }

  let lastSentAt = null
  let lastError = null

  async function currentSettings() {
    const handle = await domain()
    const values = handle.global.get()
    const table = handle.table('tasks')
    let waiting = 0
    for (const [, task] of table.entries()) {
      if (task.status !== 'open') continue
      if (dueAt(task) === null) continue
      if (task.notifiedFor === slotOf(task)) continue
      waiting += 1
    }
    return {
      enabled: Boolean(values.enabled),
      webhook: values.webhook ?? '',
      secret: values.secret ?? '',
      onboarded: Boolean(values.onboarded),
      waiting,
      lastSentAt,
      lastError,
    }
  }

  async function saveSettingsOp(input) {
    const handle = await domain()
    const current = handle.global.get()
    const next = {
      enabled: input.enabled === undefined ? current.enabled : Boolean(input.enabled),
      webhook: input.webhook === undefined ? current.webhook : normalizeWebhook(input.webhook),
      secret: input.secret === undefined ? current.secret : String(input.secret ?? '').trim().slice(0, 200),
      onboarded:
        input.onboarded === undefined ? Boolean(current.onboarded) : Boolean(input.onboarded),
    }
    if (next.enabled && !next.webhook) throw new Error('填写飞书 webhook 后才能开启提醒')
    // Turning reminders on means the setup guide was understood; do not show it again.
    if (next.enabled) next.onboarded = true
    await handle.global.set(next)
    return currentSettings()
  }

  async function testOp() {
    const handle = await domain()
    const settings = handle.global.get()
    if (!settings.webhook) throw new Error('先填写飞书 webhook')
    try {
      await postFeishu(settings, '✅ dsh-tasks-panel 通知测试：能收到这条消息，到点提醒就配好了。')
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      throw error
    }
    lastSentAt = new Date().toISOString()
    lastError = null
    return { ok: true }
  }

  /**
   * Sends at most one reminder per task slot. A slot whose deadline passed more
   * than CLOCK_GRACE_MS ago is marked silently instead of pushed, so a laptop
   * that was asleep all night does not blast yesterday's appointments.
   */
  async function runTick() {
    const handle = await domain()
    const settings = handle.global.get()
    if (!settings.enabled || !settings.webhook) return { sent: 0 }
    const table = handle.table('tasks')
    const now = Date.now()
    let sent = 0
    try {
      for (const [id, task] of table.entries()) {
        if (task.status !== 'open') continue
        const at = dueAt(task)
        if (at === null) continue
        const slot = slotOf(task)
        if (task.notifiedFor === slot) continue
        if (now < at) continue
        if (now - at > CLOCK_GRACE_MS) {
          await table.put(id, { ...task, notifiedFor: slot })
          continue
        }
        await postFeishu(settings, reminderText(task))
        await table.put(id, { ...task, notifiedFor: slot, notifiedAt: new Date().toISOString() })
        lastSentAt = new Date().toISOString()
        sent += 1
      }
      lastError = null
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    return { sent }
  }

  return {
    async list() {
      const allTasks = [...(await tasks()).entries()].map(([, value]) => ({ ...value, time: value.time ?? null }))
      const allEvents = [...(await events()).entries()].map(([, value]) => ({ ...value, time: value.time ?? null }))
      allTasks.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1
        const completed = (b.completedAt ?? '').localeCompare(a.completedAt ?? '')
        if (a.status === 'done' && completed !== 0) return completed
        const due = (a.due ?? '9999-99-99').localeCompare(b.due ?? '9999-99-99')
        if (due !== 0) return due
        const clock = (a.time ?? '99:99').localeCompare(b.time ?? '99:99')
        if (clock !== 0) return clock
        return b.createdAt.localeCompare(a.createdAt)
      })
      allEvents.sort((a, b) => a.at.localeCompare(b.at))
      return { tasks: allTasks, events: allEvents }
    },

    async add(input) {
      const title = textOrNull(input.title, 200)
      if (!title) throw new Error('a task needs a title')
      const timestamp = new Date().toISOString()
      const record = {
        id: `t_${randomUUID()}`,
        title,
        note: textOrNull(input.note, 2000),
        due: normalizeDue(input.due),
        time: normalizeTime(input.time),
        status: 'open',
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: null,
        source: input.source === 'agent' ? 'agent' : 'user',
        sessionId: textOrNull(input.sessionId, 120),
        notifiedFor: null,
        notifiedAt: null,
      }
      await (await tasks()).put(record.id, record)
      const event = await appendEvent(record, 'created', timestamp)
      return { task: record, event }
    },

    async complete(input) {
      const { table, task } = await requireTask(input.id)
      if (task.status === 'done') return { task }
      const timestamp = new Date().toISOString()
      const next = { ...task, status: 'done', completedAt: timestamp, updatedAt: timestamp }
      await table.put(next.id, next)
      const event = await appendEvent(next, 'completed', timestamp)
      return { task: next, event }
    },

    async reopen(input) {
      const { table, task } = await requireTask(input.id)
      if (task.status === 'open') return { task }
      const timestamp = new Date().toISOString()
      const next = { ...task, status: 'open', completedAt: null, updatedAt: timestamp }
      await table.put(next.id, next)
      const event = await appendEvent(next, 'reopened', timestamp)
      return { task: next, event }
    },

    async update(input) {
      const { table, task } = await requireTask(input.id)
      const timestamp = new Date().toISOString()
      const next = { ...task, updatedAt: timestamp }
      if (input.title !== undefined) {
        const title = textOrNull(input.title, 200)
        if (!title) throw new Error('a task needs a title')
        next.title = title
      }
      if (input.note !== undefined) next.note = textOrNull(input.note, 2000)
      if (input.due !== undefined) next.due = normalizeDue(input.due)
      if (input.time !== undefined) next.time = normalizeTime(input.time)
      // A moved appointment is a new slot, so it deserves a fresh reminder.
      if (input.due !== undefined || input.time !== undefined) {
        next.notifiedFor = null
        next.notifiedAt = null
      }
      await table.put(next.id, next)
      const event = await appendEvent(next, 'updated', timestamp)
      return { task: next, event }
    },

    async remove(input) {
      const { table, task } = await requireTask(input.id)
      const timestamp = new Date().toISOString()
      await table.delete(task.id)
      const event = await appendEvent(task, 'deleted', timestamp)
      return { task, event }
    },

    async clearCompleted() {
      const table = await tasks()
      const timestamp = new Date().toISOString()
      const done = [...table.entries()].map(([, value]) => value).filter((task) => task.status === 'done')
      for (const task of done) {
        await table.delete(task.id)
        await appendEvent(task, 'deleted', timestamp)
      }
      return { removed: done.length }
    },

    settings: currentSettings,
    saveSettings: saveSettingsOp,
    testNotify: testOp,
    tick: runTick,

    dispose() {
      const pending = opened
      opened = null
      if (pending) pending.then((handle) => handle.close()).catch(() => {})
    },
  }
}

async function readJson(request) {
  const text = await request.text()
  if (Buffer.byteLength(text) > MAX_BODY) throw new Error('request body too large')
  if (!text) return {}
  const parsed = JSON.parse(text)
  return parsed && typeof parsed === 'object' ? parsed : {}
}

function json(status, payload) {
  return Response.json(payload, { status, headers: { 'cache-control': 'no-store' } })
}

const TOOL_ACTIONS = ['add', 'complete', 'reopen', 'update', 'remove', 'list']

function createTool(ops) {
  return {
    name: 'task_write',
    description:
      'Manage the user\'s task list (the "Tasks" page in the sidebar). Use action "add" to record something the user should still do, "complete" when it is done, "list" to read what is open. Give "due" (YYYY-MM-DD) and, when the user named a time, "time" (HH:mm) — an appointment like "class at 18:30" keeps both. Every change is recorded with a timestamp and shows up on the Tasks calendar, so completing tasks is how the user sees what got done each day.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: TOOL_ACTIONS,
          description: 'add | complete | reopen | update | remove | list',
        },
        id: { type: 'string', description: 'Task id (from "list"), required by every action except add and list.' },
        title: { type: 'string', description: 'Task title. Required by add, optional for update.' },
        note: { type: 'string', description: 'Optional longer note.' },
        due: { type: 'string', description: 'Optional due date as YYYY-MM-DD.' },
        time: { type: 'string', description: 'Optional time of day as HH:mm (24h), e.g. "18:30" for half past six in the evening.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', description: 'The task (or task list) that the action produced.' },
      render(args, value) {
        return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
      },
    },
    async execute(args, exec) {
      const input = args && typeof args === 'object' ? args : {}
      const action = String(input.action ?? '')
      const asAgent = { source: 'agent', sessionId: exec?.agent?.id ? String(exec.agent.id) : null }
      if (action === 'list') {
        const state = await ops.list()
        return {
          open: state.tasks
            .filter((task) => task.status === 'open')
            .map((task) => ({ id: task.id, title: task.title, due: task.due, time: task.time })),
          recentlyCompleted: state.tasks
            .filter((task) => task.status === 'done')
            .slice(0, 10)
            .map((task) => ({ id: task.id, title: task.title, completedAt: task.completedAt })),
        }
      }
      if (action === 'add') return ops.add({ ...input, ...asAgent })
      if (action === 'complete') return ops.complete(input)
      if (action === 'reopen') return ops.reopen(input)
      if (action === 'update') return ops.update(input)
      if (action === 'remove') return ops.remove(input)
      throw new Error(`unknown action: ${action} (expected one of ${TOOL_ACTIONS.join(', ')})`)
    },
  }
}

export function apply(ctx) {
  const ops = createOps(ctx)
  ctx.effect(() => () => ops.dispose(), 'dsh-tasks-panel: storage domain')

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: ROUTE,
        methods: ['POST'],
        requestBody: 'buffered',
        async fetch(request) {
          try {
            const body = await readJson(request)
            const op = String(body.op ?? '')
            const run = ops[op]
            if (typeof run !== 'function') {
              return json(400, { ok: false, error: { message: `unknown op: ${op}` } })
            }
            return json(200, { ok: true, value: await run.call(ops, body) })
          } catch (error) {
            return json(400, {
              ok: false,
              error: { message: error instanceof Error ? error.message : String(error) },
            })
          }
        },
      }),
    'dsh-tasks-panel: api route',
  )

  ctx.effect(() => ctx.tools.register(createTool(ops)), 'dsh-tasks-panel: task_write tool')

  // One reminder pass at boot, then every TICK_MS while the harness runs.
  ctx.effect(() => {
    let stopped = false
    const pass = () => {
      if (stopped) return
      void ops.tick().catch(() => {})
    }
    pass()
    const timer = setInterval(pass, TICK_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, 'dsh-tasks-panel: reminder ticker')
}
