import { apply } from '../index.js'

const tables = { tasks: new Map(), events: new Map() }
const routes = []
const disposers = []
let stored = { enabled: false, webhook: '', secret: '' }
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
  }
}

const ctx = {
  storageDomain: {
    open: async (spec) => ({
      name: spec.name,
      table: (name) => makeTable(tables[name]),
      global: {
        get: () => ({ ...stored }),
        set: async (value) => {
          stored = { ...value }
        },
      },
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
    register() {
      return () => {}
    },
  },
  effect(fn, label) {
    // Keep the 30s ticker out of the test: steps call op "tick" explicitly.
    if (label === 'dsh-tasks: reminder ticker') return () => {}
    const disposer = fn()
    if (typeof disposer === 'function') disposers.push(disposer)
    return disposer
  },
}

const sent = []
let feishuReply = { code: 0, msg: 'success' }
globalThis.fetch = async (url, init) => {
  sent.push({ url, body: JSON.parse(init.body) })
  return new Response(JSON.stringify(feishuReply), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

apply(ctx)

const route = routes[0]
async function callApi(body) {
  const request = new Request('http://127.0.0.1/api/dsh-tasks/op', {
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
  checks.push({ label, ok: !!condition })
  if (!condition) console.log('FAIL', label, detail === undefined ? '' : JSON.stringify(detail).slice(0, 300))
}

function at(minutesFromNow) {
  const when = new Date(Date.now() + minutesFromNow * 60 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return {
    due: `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`,
    time: `${pad(when.getHours())}:${pad(when.getMinutes())}`,
  }
}

// --- settings defaults ------------------------------------------------------
const initial = await callApi({ op: 'settings' })
check('settings default disabled', initial.value?.enabled === false, initial.value)
check('settings default empty webhook', initial.value?.webhook === '', initial.value)
check('guide not seen yet', initial.value?.onboarded === false, initial.value)

// --- validation -------------------------------------------------------------
const badUrl = await callApi({ op: 'saveSettings', webhook: 'not-a-url' })
check('rejects non-url webhook', badUrl.status === 400 && /http/i.test(badUrl.error?.message ?? ''), badUrl)
const noHook = await callApi({ op: 'saveSettings', enabled: true })
check('cannot enable without webhook', noHook.status === 400 && /webhook/i.test(noHook.error?.message ?? ''), noHook)

const hook = 'https://open.feishu.cn/open-apis/bot/v2/hook/test-hook'
const saved = await callApi({ op: 'saveSettings', enabled: true, webhook: hook, secret: 'sec123' })
check('settings saved', saved.value?.enabled === true && saved.value?.webhook === hook, saved.value)
check('enabling marks the guide seen', saved.value?.onboarded === true, saved.value)

// --- test message -----------------------------------------------------------
const testMsg = await callApi({ op: 'testNotify' })
check('test notify ok', testMsg.ok === true && sent.length === 1, testMsg)
check('test uses text message', sent[0]?.body?.msg_type === 'text' && /测试/.test(sent[0]?.body?.content?.text ?? ''), sent[0]?.body)
check('test signed when secret set', typeof sent[0]?.body?.sign === 'string' && typeof sent[0]?.body?.timestamp === 'string', sent[0]?.body)

// --- tick: due now ----------------------------------------------------------
const soon = at(-1)
const dueNow = await callApi({ op: 'add', title: '上课', due: soon.due, time: soon.time, note: '带课本' })
const dueId = dueNow.value?.task?.id
const waiting = await callApi({ op: 'settings' })
check('waiting counts due task', waiting.value?.waiting === 1, waiting.value)

const before = sent.length
const tick1 = await callApi({ op: 'tick' })
check('tick sent one', tick1.value?.sent === 1 && sent.length === before + 1, tick1.value)
check('reminder text has title', /上课/.test(sent[sent.length - 1]?.body?.content?.text ?? ''), sent[sent.length - 1]?.body)
check('reminder text has note', /带课本/.test(sent[sent.length - 1]?.body?.content?.text ?? ''))
const afterTick = await callApi({ op: 'list' })
const marked = afterTick.value?.tasks?.find((task) => task.id === dueId)
check('task marked notified', marked?.notifiedFor === `${soon.due}T${soon.time}` && typeof marked?.notifiedAt === 'string', marked)

const tick2 = await callApi({ op: 'tick' })
check('second tick deduped', tick2.value?.sent === 0 && sent.length === before + 1, tick2.value)

// --- tick: stale slot stays silent -----------------------------------------
const stale = at(-7 * 60)
const staleTask = await callApi({ op: 'add', title: '老会议', due: stale.due, time: stale.time })
const staleId = staleTask.value?.task?.id
const beforeStale = sent.length
const tick3 = await callApi({ op: 'tick' })
check('stale slot not pushed', tick3.value?.sent === 0 && sent.length === beforeStale, tick3.value)
const staleList = await callApi({ op: 'list' })
const staleMarked = staleList.value?.tasks?.find((task) => task.id === staleId)
check('stale slot marked silently', typeof staleMarked?.notifiedFor === 'string' && staleMarked?.notifiedAt === null, staleMarked)

// --- task without a clock never reminds ------------------------------------
const dateOnly = await callApi({ op: 'add', title: '交房租', due: stale.due })
const beforeDateOnly = sent.length
await callApi({ op: 'tick' })
const dateOnlyList = await callApi({ op: 'list' })
const dateOnlyTask = dateOnlyList.value?.tasks?.find((task) => task.id === dateOnly.value?.task?.id)
check('date-only task never reminds', dateOnlyTask?.notifiedFor === null && sent.length === beforeDateOnly, dateOnlyTask)

// --- moving the clock re-arms the reminder ---------------------------------
const moved = at(-1)
const movedTask = await callApi({ op: 'update', id: staleId, due: moved.due, time: moved.time })
check('move clears notified', movedTask.value?.task?.notifiedFor === null, movedTask.value?.task)
const tick4 = await callApi({ op: 'tick' })
check('moved task reminds again', tick4.value?.sent === 1, tick4.value)
const movedList = await callApi({ op: 'list' })
const movedAfter = movedList.value?.tasks?.find((task) => task.id === staleId)
check('re-marks moved slot', movedAfter?.notifiedFor === `${moved.due}T${moved.time}`)

// --- feishu rejection surfaces as an error ---------------------------------
feishuReply = { code: 19001, msg: 'param invalid: incoming webhook sign mismatch' }
const rejected = await callApi({ op: 'testNotify' })
check('feishu rejection reported', rejected.status === 400 && /Feishu rejected/.test(rejected.error?.message ?? ''), rejected)
const reported = await callApi({ op: 'settings' })
check('last error stored for the panel', /sign mismatch/.test(reported.value?.lastError ?? ''), reported.value)
feishuReply = { code: 0, msg: 'success' }

// --- disabled switch stops sends -------------------------------------------
await callApi({ op: 'saveSettings', enabled: false })
const quiet = at(-1)
await callApi({ op: 'add', title: '静默测试', due: quiet.due, time: quiet.time })
const beforeQuiet = sent.length
const tick5 = await callApi({ op: 'tick' })
check('disabled sends nothing', tick5.value?.sent === 0 && sent.length === beforeQuiet, tick5.value)

for (const disposer of disposers) disposer()
await new Promise((resolve) => setTimeout(resolve, 20))
check('domain closed once', closed === 1, closed)

const failed = checks.filter((entry) => !entry.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length) process.exitCode = 1
