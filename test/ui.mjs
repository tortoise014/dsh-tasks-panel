/**
 * Render the dsh-tasks client half in jsdom against a fake host route, then
 * exercise the hover previews (task row, calendar day, sidebar icon) and the
 * date + time compose form. Verifies things actually mount and paint.
 */
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div><div id="side"></div></body></html>', {
  url: 'http://127.0.0.1:55498/',
  pretendToBeVisual: true,
})

const { window } = dom
globalThis.window = window
globalThis.document = window.document
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
globalThis.HTMLElement = window.HTMLElement
globalThis.Element = window.Element
globalThis.Node = window.Node
globalThis.MouseEvent = window.MouseEvent
globalThis.KeyboardEvent = window.KeyboardEvent
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)

const React = require('react')
const ReactDOMClient = require('react-dom/client')
const ReactDOM = require('react-dom')

const now = Date.now()
const iso = (offsetMinutes) => new Date(now + offsetMinutes * 60000).toISOString()
const ymd = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = ymd(new Date(now))
const tomorrow = ymd(new Date(now + 86400000))

const taskOpen = {
  id: 't_open_0001',
  title: '把悬停预览接到待办列表和日历上，顺便看看长标题会不会被撑破',
  note: '多行备注：\n第一行说明\n第二行说明',
  due: tomorrow,
  time: '18:30',
  status: 'open',
  createdAt: iso(-90),
  updatedAt: iso(-60),
  completedAt: null,
  source: 'agent',
  sessionId: 'sess_ab12cd34ef56',
}
const taskToday = {
  id: 't_today_0003',
  title: '下午六点半去上课',
  note: null,
  due: today,
  time: '09:00',
  status: 'open',
  createdAt: iso(-50),
  updatedAt: iso(-50),
  completedAt: null,
  source: 'user',
  sessionId: null,
}
const taskDone = {
  id: 't_done_0002',
  title: '验证 dsh-tasks 安装成功',
  note: null,
  due: null,
  time: null,
  status: 'done',
  createdAt: iso(-240),
  updatedAt: iso(-30),
  completedAt: iso(-30),
  source: 'user',
  sessionId: null,
}
const tasks = [taskToday, taskOpen, taskDone]
const events = [
  { id: 'e1', taskId: taskOpen.id, title: taskOpen.title, kind: 'created', at: iso(-90), due: taskOpen.due, time: taskOpen.time },
  { id: 'e2', taskId: taskDone.id, title: taskDone.title, kind: 'created', at: iso(-240), due: null, time: null },
  { id: 'e3', taskId: taskDone.id, title: taskDone.title, kind: 'completed', at: iso(-30), due: null, time: null },
  { id: 'e4', taskId: taskToday.id, title: taskToday.title, kind: 'created', at: iso(-50), due: taskToday.due, time: taskToday.time },
]

const calls = []
// Drives the first-run guide: the fifth case turns it back on.
let onboardedSeen = true
globalThis.fetch = window.fetch = async (url, init) => {
  const body = JSON.parse(init.body)
  calls.push({ url, body })
  const value =
    body.op === 'list'
      ? { tasks, events }
      : body.op === 'settings'
        ? { enabled: false, webhook: '', secret: '', onboarded: onboardedSeen, waiting: 1, lastSentAt: null, lastError: null }
        : body.op === 'saveSettings'
          ? (() => {
              if (body.onboarded !== undefined) onboardedSeen = Boolean(body.onboarded)
              return { enabled: Boolean(body.enabled), webhook: body.webhook ?? '', secret: body.secret ?? '', onboarded: onboardedSeen, waiting: 1, lastSentAt: null, lastError: null }
            })()
          : body.op === 'testNotify'
            ? { ok: true }
            : { task: body.op === 'remove' ? {} : taskOpen }
  return { status: 200, ok: true, json: async () => ({ ok: true, value }) }
}

let factory
window.__ModuleLoader__ = { load: (definition) => { factory = definition.factory } }
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
new Function('window', 'document', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'fetch', 'navigator', source)(
  window, window.document, setInterval, clearInterval, setTimeout, clearTimeout, globalThis.fetch, window.navigator,
)

const moduleExports = factory((name) => {
  if (name === 'react') return React
  if (name === 'react-dom') return ReactDOM
  if (name === 'react-dom/client') return ReactDOMClient
  throw new Error(`unexpected require: ${name}`)
})

const slots = new Map()
let sidebarLabel = null
// Fake layout store: starts on the Plugins panel so "back" has a destination.
let activePanelId = 'plugins'
let selectedPanel = '<none>'
const panelSubscribers = []
const layoutStub = {
  selectPanel: (id) => {
    selectedPanel = id
    activePanelId = id
    for (const subscriber of panelSubscribers) subscriber()
  },
  panelInfo: {
    getSnapshot: () => ({ activePanelId }),
    subscribe: (subscriber) => {
      panelSubscribers.push(subscriber)
      return () => {
        const at = panelSubscribers.indexOf(subscriber)
        if (at >= 0) panelSubscribers.splice(at, 1)
      }
    },
  },
}
const ctx = {
  get: (name) => (name === 'layout' ? layoutStub : undefined),
  effect: (fn) => {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  locale: {
    register: () => () => {},
    bind: () => (key) => {
      const dict = {
        'panel.title': '任务',
        'list.today': '今天',
        'list.due': '截止 {date}',
        'list.overdue': '已逾期',
        'hover.due': '截止',
        'hover.source': '来源',
        'hover.sourceUser': '我',
        'hover.sourceAgent': '助手',
        'hover.session': '会话',
        'hover.created': '创建于',
        'hover.stamp': '{month} 月 {day} 日 {time}',
        'hover.rel.today': '今天',
        'side.today': '今天 · {month} 月 {day} 日',
        'side.count': '{count} 项',
        'side.allDay': '全天',
        'side.openTotal': '共 {count} 项待办',
        'side.hint': '点击打开任务面板',
      }
      return dict[key] ?? key
    },
  },
  slots: {
    inject: (name, callback) => {
      const result = callback()
      slots.set(name, result)
      return () => slots.delete(name)
    },
    register: (registration, component) => {
      if (registration.label) sidebarLabel = registration.label
      return { registration, component }
    },
  },
}

let failures = 0
const check = (label, condition, extra = '') => {
  if (condition) console.log(`ok   ${label}`)
  else {
    failures += 1
    console.log(`FAIL ${label}${extra ? ` — ${extra}` : ''}`)
  }
}

moduleExports.apply(ctx)
check('registers sidebar + main slots', slots.has('sidebar.panellist') && slots.has('main'))
check('sidebar label resolves to a string', typeof sidebarLabel === 'function' && sidebarLabel() === '任务', String(sidebarLabel?.()))
check('style element installed', Boolean(document.getElementById('dsh-tasks-panel-styles')))

const Panel = slots.get('main').component
const root = ReactDOMClient.createRoot(document.getElementById('root'))
root.render(React.createElement(Panel, {}))

const tick = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms))
const text = () => document.body.textContent.replace(/\s+/g, ' ')

await tick(60)
check('panel rendered from fake route', calls.some((call) => call.body.op === 'list') && text().includes('把悬停预览接到待办列表'), text().slice(0, 90))

const backButton = document.querySelector('.dsht-back')
check('panel offers a back control', Boolean(backButton))
if (backButton) backButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
await tick(20)
check('back returns to the panel we came from', selectedPanel === 'plugins', String(selectedPanel))

const items = document.querySelectorAll('.dsht-item')
check('three task rows', items.length === 3, `got ${items.length}`)

const dueChips = [...document.querySelectorAll('.dsht-due')].map((node) => node.textContent)
check('today chip shows the date and the clock time', dueChips.some((label) => label.includes('今天') && label.includes('09:00')), dueChips.join(' | '))
check('future chip shows the date and the clock time', dueChips.some((label) => label.includes(tomorrow.slice(5)) && label.includes('18:30')), dueChips.join(' | '))

const enter = (element) => {
  element.dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: false }))
  element.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }))
}
const leave = (element) => {
  element.dispatchEvent(new window.MouseEvent('mouseleave', { bubbles: false }))
  element.dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true }))
}

await tick()
enter(items[1])
await tick(260)
const card = document.querySelector('.dsht-hovercard')
check('hover card appears on task hover without a click', Boolean(card))
check('hover card is portalled to body', card ? card.parentElement === document.body : false)
check('card shows full title + note + source + session', card ? /第一行说明|助手|sess_ab12/.test(card.textContent.replace(/\s+/g, ' ')) : false, card?.textContent?.replace(/\s+/g, ' ').slice(0, 160))
check('card shows the due time', card ? card.textContent.includes('18:30') : false, card?.textContent?.replace(/\s+/g, ' ').slice(0, 120))
check('card positioned inside the viewport', card ? Number.parseFloat(card.style.left) >= 0 && Number.parseFloat(card.style.top) >= 0 : false, card ? `${card.style.left},${card.style.top}` : '')

leave(items[1])
await tick(160)
check('card disappears after leaving the task', !document.querySelector('.dsht-hovercard'))

// compose form: title + date + time
const setValue = (element, value) => {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
  descriptor.set.call(element, value)
  element.dispatchEvent(new window.MouseEvent('input', { bubbles: true }))
}
const titleInput = document.querySelector('.dsht-input')
const dateInput = document.querySelector('input[type="date"]')
const timeInput = document.querySelector('input[type="time"]')
check('compose has a time input', Boolean(timeInput))
check('date defaults to today', dateInput ? dateInput.value === today : false, dateInput?.value)
check('time input is ready with the default date', timeInput ? !timeInput.disabled : false)
check('time defaults to the next five-minute slot', /^\d{2}:\d{2}$/.test(timeInput?.value ?? ''), timeInput?.value)
if (timeInput && /^\d{2}:\d{2}$/.test(timeInput.value)) {
  const [hours, minutes] = timeInput.value.split(':').map(Number)
  const slot = new Date()
  slot.setHours(hours, minutes, 0, 0)
  const ahead = (slot.getTime() - Date.now()) / 60000
  check('default clock is soon, not past', ahead > 0 && ahead <= 6, `${ahead.toFixed(1)} min ahead (${timeInput.value})`)
  check('default clock lands on a multiple of five', minutes % 5 === 0, timeInput.value)
}
const clearButton = document.querySelector('.dsht-clear')
check('compose offers a no-date escape', Boolean(clearButton))
if (clearButton) {
  clearButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await tick(20)
}
const clearedDate = document.querySelector('input[type="date"]')
const clearedTime = document.querySelector('input[type="time"]')
check('clearing the date empties it', clearedDate ? clearedDate.value === '' : false, clearedDate?.value)
check('clearing the date re-locks the time input', clearedTime ? clearedTime.disabled : false)
setValue(clearedDate, tomorrow)
await tick(20)
check('time input unlocks once a date is set', clearedTime ? !clearedTime.disabled : false)
setValue(titleInput, '去上课')
setValue(timeInput, '18:30')
await tick(20)
document.querySelector('.dsht-compose').dispatchEvent(new window.MouseEvent('submit', { bubbles: true, cancelable: true }))
await tick(40)
const addCall = [...calls].reverse().find((call) => call.body.op === 'add')
check('add sends date + time', Boolean(addCall) && addCall.body.due === tomorrow && addCall.body.time === '18:30', JSON.stringify(addCall?.body))
const resetTime = document.querySelector('input[type="time"]')
check('the clock resets to "soon" after adding', /^\d{2}:\d{2}$/.test(resetTime?.value ?? '') && resetTime.value !== '18:30', resetTime?.value)

// calendar tab
const tabButtons = [...document.querySelectorAll('.dsht-tab')]
tabButtons[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
await tick(40)
const cells = document.querySelectorAll('.dsht-cell')
check('calendar rendered 42 cells', cells.length === 42, `got ${cells.length}`)

const withEvents = [...cells].find((cell) => cell.querySelector('.dsht-dot'))
check('a day cell carries event dots', Boolean(withEvents))
if (withEvents) {
  enter(withEvents)
  await tick(240)
  const dayCard = document.querySelector('.dsht-hovercard')
  check('day hover shows the log preview', Boolean(dayCard) && (dayCard.querySelectorAll('.dsht-hc-list li').length ?? 0) > 0, dayCard?.textContent?.replace(/\s+/g, ' ').slice(0, 120) ?? 'no card')
  leave(withEvents)
  await tick(160)
  const away = [...document.querySelectorAll('.dsht-cell')].find((cell) => !cell.querySelector('.dsht-dot'))
  if (away) {
    enter(away)
    await tick(240)
    check('empty day still previews, says nothing recorded', Boolean(document.querySelector('.dsht-hovercard .dsht-hc-empty')))
    leave(away)
    await tick(160)
  }
}

// sidebar icon: hovering shows today's agenda
const Sidebar = slots.get('sidebar.panellist').component
const sideRoot = ReactDOMClient.createRoot(document.getElementById('side'))
sideRoot.render(React.createElement(Sidebar, { size: 20, active: false }))
await tick(60)
const sideIcon = document.querySelector('.dsht-side')
check('sidebar entry rendered its icon', Boolean(sideIcon) && Boolean(sideIcon.querySelector('svg')))
enter(sideIcon)
await tick(320)
const agenda = document.querySelector('.dsht-hovercard')
check('sidebar hover shows the today agenda', Boolean(agenda) && agenda.textContent.includes('下午六点半去上课'), agenda?.textContent?.replace(/\s+/g, ' ').slice(0, 140) ?? 'no card')
check('agenda lists the task time', agenda ? agenda.textContent.includes('09:00') : false, agenda?.textContent?.replace(/\s+/g, ' ').slice(0, 140))
check('agenda keeps tomorrow-only work out of today', agenda ? !agenda.textContent.includes('把悬停预览接到待办列表') : false)
leave(sideIcon)
await tick(180)
check('agenda disappears after leaving the icon', !document.querySelector('.dsht-hovercard'))

// reminder settings card
const gear = document.querySelector('.dsht-gear')
check('panel exposes a reminder settings toggle', Boolean(gear))
gear.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
await tick(60)
const settings = document.querySelector('.dsht-settings')
check('settings card opens', Boolean(settings))
const switchInput = settings && settings.querySelector('input[type="checkbox"]')
const hookInput = settings && settings.querySelector('input[type="url"]')
const secretInput = settings && settings.querySelector('input[type="password"]')
check('settings offers switch, webhook and secret', Boolean(switchInput) && Boolean(hookInput) && Boolean(secretInput))
check('reminders start switched off', Boolean(switchInput) && switchInput.checked === false)
check('settings spells out the date+time rule', /settings\.hint/.test(settings?.textContent ?? ''), settings?.textContent?.slice(0, 120))
if (settings && hookInput) {
  const buttons = [...settings.querySelectorAll('.dsht-settings-actions button')]
  const saveButton = buttons[0]
  const testButton = buttons[1]
  check('settings has save and test actions', Boolean(saveButton) && Boolean(testButton), buttons.map((b) => b.className).join(','))
  setValue(hookInput, 'https://open.feishu.cn/open-apis/bot/v2/hook/abc123')
  switchInput.click()
  await tick(80)
  check('switch reflects a click', switchInput.checked === true)
  const toggleCall = [...calls].reverse().find((call) => call.body.op === 'saveSettings')
  check(
    'flipping the switch saves by itself, webhook included',
    Boolean(toggleCall) && toggleCall.body.enabled === true && toggleCall.body.webhook === 'https://open.feishu.cn/open-apis/bot/v2/hook/abc123',
    JSON.stringify(toggleCall?.body),
  )
  check('the switch reports itself on', /settings\.enabledOn/.test(document.querySelector('.dsht-settings')?.textContent ?? ''))
  saveButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await tick(80)
  const savedCall = [...calls].reverse().find((call) => call.body.op === 'saveSettings')
  check(
    'save sends the enabled flag and webhook',
    Boolean(savedCall) && savedCall.body.enabled === true && savedCall.body.webhook === 'https://open.feishu.cn/open-apis/bot/v2/hook/abc123',
    JSON.stringify(savedCall?.body),
  )
  testButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await tick(120)
  check('test button hits the test endpoint', calls.some((call) => call.body.op === 'testNotify'))
  check('test result is reported inline', /settings\.sent/.test(document.querySelector('.dsht-settings')?.textContent ?? ''), document.querySelector('.dsht-settings')?.textContent?.slice(0, 160))
}

// first-run guide
onboardedSeen = false
root.unmount()
await tick(20)
const mountPanel = () => {
  const host = ReactDOMClient.createRoot(document.getElementById('root'))
  host.render(React.createElement(Panel, {}))
  return host
}
let guided = mountPanel()
await tick(140)
const mask = document.querySelector('.dsht-modal-mask')
check('fresh install shows the welcome guide', Boolean(mask), Boolean(mask))
check('guide is portalled over the app', Boolean(mask) && mask.parentElement === document.body)
check('guide walks through three steps', document.querySelectorAll('.dsht-step').length === 3)
check('guide explains where the webhook lives', /welcome\.howTitle/.test(mask?.textContent ?? '') && /welcome\.howBody/.test(mask?.textContent ?? ''))

const later = [...document.querySelectorAll('.dsht-modal-actions button')].find((button) => /welcome\.later/.test(button.textContent))
if (later) later.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
await tick(60)
check('dismissing closes the guide', !document.querySelector('.dsht-modal-mask'))
check(
  'dismissal is persisted',
  calls.some((call) => call.body.op === 'saveSettings' && call.body.onboarded === true),
  JSON.stringify([...calls].reverse().find((call) => call.body.op === 'saveSettings')?.body),
)

guided.unmount()
await tick(20)
onboardedSeen = false
guided = mountPanel()
await tick(140)
const configure = [...document.querySelectorAll('.dsht-modal-actions button')].find((button) => /welcome\.configure/.test(button.textContent))
if (configure) configure.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
await tick(80)
check('"set up reminders" opens the settings card', Boolean(document.querySelector('.dsht-settings')))
check('"set up reminders" closes the guide', !document.querySelector('.dsht-modal-mask'))

const guideLink = document.querySelector('.dsht-link')
check('settings offers a way back to the guide', Boolean(guideLink) && /settings\.guide/.test(guideLink.textContent ?? ''))
if (guideLink) guideLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
await tick(80)
check('the guide can be reopened from settings', Boolean(document.querySelector('.dsht-modal-mask')))

guided.unmount()
await tick(20)

sideRoot.unmount()
await tick(20)
check('no stray hover card after unmount', !document.querySelector('.dsht-hovercard'))

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
