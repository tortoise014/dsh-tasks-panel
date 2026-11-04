import { Readable } from 'node:stream'
import { apply } from '../index.js'

const tables = { tasks: new Map(), events: new Map() }
const routes = []
const tools = []
const disposers = []
let closed = 0

function makeTable(map) {
  return {
    get: (key) => map.get(key),
    entries: () => map.entries(),
    keys: () => map.keys(),
    get size() {
      return map.size
    },
    put: async (key, value) => {
      map.set(key, value)
    },
    delete: async (key) => map.delete(key),
    update: async (key, fn) => {
      const next = fn(map.get(key))
      map.set(key, next)
      return next
    },
  }
}

const ctx = {
  storageDomain: {
    open: async (spec) => ({
      name: spec.name,
      table: (name) => makeTable(tables[name]),
      close: async () => {
        closed += 1
      },
    }),
  },
  connection: {
    fetch: {
      register(route) {
        routes.push(route)
        return async () => {}
      },
    },
  },
  tools: {
    register(definition) {
      tools.push(definition)
      return () => {}
    },
  },
  effect(fn) {
    const disposer = fn()
    if (typeof disposer === 'function') disposers.push(disposer)
    return disposer
  },
}

apply(ctx)

const route = routes[0]
const tool = tools[0]

async function callApi(body) {
  const request = new Request('http://127.0.0.1/api/dsh-tasks-panel/op', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const response = await route.fetch(request)
  const payload = await response.json()
  return { status: response.status, ...payload }
}

const checks = []
function check(label, condition, detail) {
  checks.push({ label, ok: !!condition, detail })
  if (!condition) console.log('FAIL', label, detail ?? '')
}

// --- route: add -------------------------------------------------------------
const added = await callApi({ op: 'add', title: '  写插件  ', due: '2026-11-05', time: '9:05' })
check('add ok', added.ok === true, added)
check('title trimmed', added.value?.task?.title === '写插件', added.value?.task?.title)
check('due normalized', added.value?.task?.due === '2026-11-05')
check('time normalized to HH:mm', added.value?.task?.time === '09:05', added.value?.task?.time)
check('status open', added.value?.task?.status === 'open')
check('source user', added.value?.task?.source === 'user')
const id = added.value?.task?.id

// --- route: list ------------------------------------------------------------
const listed = await callApi({ op: 'list' })
check('list ok', listed.ok === true)
check('list one task', listed.value?.tasks?.length === 1)
check('list one event', listed.value?.events?.length === 1)
check('event created', listed.value?.events?.[0]?.kind === 'created')
check('event carries the time', listed.value?.events?.[0]?.time === '09:05', listed.value?.events?.[0]?.time)

// --- route: complete --------------------------------------------------------
const done = await callApi({ op: 'complete', id })
check('complete ok', done.ok === true)
check('completedAt set', typeof done.value?.task?.completedAt === 'string')
check('complete event', done.value?.event?.kind === 'completed')

// --- route: reopen ----------------------------------------------------------
const reopened = await callApi({ op: 'reopen', id })
check('reopen ok', reopened.value?.task?.status === 'open')
check('reopen event', reopened.value?.event?.kind === 'reopened')

// --- route: update ----------------------------------------------------------
const updated = await callApi({ op: 'update', id, note: 'note text', due: null, time: '18:30' })
check('update note', updated.value?.task?.note === 'note text')
check('update clears due', updated.value?.task?.due === null)
check('update keeps a standalone time', updated.value?.task?.time === '18:30', updated.value?.task?.time)
check('update event', updated.value?.event?.kind === 'updated')
const badTime = await callApi({ op: 'add', title: '早茶', due: '2026-11-06', time: '25:99' })
check('invalid time rejected', badTime.status === 400 && /time/.test(badTime.error?.message ?? ''), badTime)

// --- route: errors ----------------------------------------------------------
const unknownOp = await callApi({ op: 'nope' })
check('unknown op 400', unknownOp.status === 400 && unknownOp.ok === false)
const missing = await callApi({ op: 'complete', id: 't_missing' })
check('missing task 400', missing.status === 400, missing)
const noTitle = await callApi({ op: 'add', title: '   ' })
check('empty title rejected', noTitle.status === 400)

// --- route: registration shape ---------------------------------------------
check('route path', route?.path === '/api/dsh-tasks-panel/op', route?.path)
check('route methods', Array.isArray(route?.methods) && route.methods.length === 1 && route.methods[0] === 'POST', route?.methods)
check('route body mode', route?.requestBody === 'buffered', route?.requestBody)

// --- tool -------------------------------------------------------------------
check('tool name', tool?.name === 'task_write', tool?.name)
const toolAdd = await tool.execute({ action: 'add', title: '助手记的事', due: '2026-11-09' }, { agent: { id: 'session-x' } })
check('tool add source agent', toolAdd?.task?.source === 'agent', toolAdd?.task)
check('tool add sessionId', toolAdd?.task?.sessionId === 'session-x')
const toolList = await tool.execute({ action: 'list' }, { agent: { id: 'session-x' } })
check('tool list open', toolList?.open?.some((task) => task.title === '助手记的事'))
const toolComplete = await tool.execute({ action: 'complete', id: toolAdd.task.id }, { agent: { id: 'session-x' } })
check('tool complete', toolComplete?.task?.status === 'done')
let toolError = null
try {
  await tool.execute({ action: 'explode' }, {})
} catch (error) {
  toolError = error.message
}
check('tool unknown action throws', typeof toolError === 'string' && toolError.includes('unknown action'), toolError)
check('tool render text', Array.isArray(tool.output.render({}, { a: 1 })) && tool.output.render({}, { a: 1 })[0].type === 'text')

// --- remove -----------------------------------------------------------------
const removed = await callApi({ op: 'remove', id })
check('remove ok', removed.ok === true)
check('remove event', removed.value?.event?.kind === 'deleted')
const after = await callApi({ op: 'list' })
check('task gone', after.value.tasks.every((task) => task.id !== id))

// --- dispose ----------------------------------------------------------------
for (const disposer of disposers) disposer()
await new Promise((resolve) => setTimeout(resolve, 20))
check('domain closed', closed === 1, closed)

const failed = checks.filter((entry) => !entry.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length) process.exitCode = 1
