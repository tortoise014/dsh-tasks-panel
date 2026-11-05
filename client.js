/**
 * dsh-tasks-panel — browser half.
 *
 * A sidebar entry ("Tasks") whose main panel holds two views: the open to-do
 * list, and a month calendar of every task event (added / finished / reopened)
 * so the user can look back at what happened on a given day.
 */
window.__ModuleLoader__.load({
  id: 'dsh-tasks-panel',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const h = React.createElement

    const { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } = React

    const API = 'api/dsh-tasks-panel/op'

    const ZH = {
      'panel.title': '任务',
      'panel.subtitle': '待办 {open} 项 · 今天完成 {done} 项',
      'panel.subtitleEmpty': '记下要做的事，之后按日历回看',
      'tab.todo': '待办',
      'tab.calendar': '日历',
      'compose.placeholder': '添加一件要做的事…',
      'compose.due': '截止',
      'compose.time': '时间',
      'compose.clearDue': '不设日期',
      'compose.add': '添加',
      'panel.back': '返回',
      'list.open': '待完成',
      'list.done': '已完成',
      'list.empty': '暂无待办，添加一件吧。',
      'list.emptyDone': '还没有完成的任务。',
      'list.overdue': '已逾期',
      'list.today': '今天',
      'list.due': '截止 {date}',
      'list.fromAgent': '来自助手',
      'list.auto': '到点完成',
      'list.autoTitle': '到点提醒推出去之后自动标记为完成',
      'list.delete': '删除',
      'list.reopen': '重新打开',
      'calendar.prev': '上个月',
      'calendar.next': '下个月',
      'calendar.today': '今天',
      'calendar.month': '{year} 年 {month} 月',
      'calendar.weekday.0': '一',
      'calendar.weekday.1': '二',
      'calendar.weekday.2': '三',
      'calendar.weekday.3': '四',
      'calendar.weekday.4': '五',
      'calendar.weekday.5': '六',
      'calendar.weekday.6': '日',
      'calendar.dayTitle': '{month} 月 {day} 日',
      'calendar.dayEmpty': '这一天没有记录。',
      'calendar.hint': '点日历上的任意一天，查看当天发生了什么。',
      'event.created': '新增',
      'event.completed': '完成',
      'event.autoCompleted': '到点完成',
      'event.reopened': '重新打开',
      'event.updated': '修改',
      'event.deleted': '删除',
      'state.loading': '载入中…',
      'state.failed': '载入失败：{message}',
      'state.retry': '重试',
      'hover.due': '截止',
      'hover.source': '来源',
      'hover.sourceUser': '我',
      'hover.sourceAgent': '助手',
      'hover.session': '会话',
      'hover.created': '创建于',
      'hover.completed': '完成于',
      'hover.auto': '完成方式',
      'hover.autoValue': '到点提醒推送后自动完成',
      'hover.stamp': '{month} 月 {day} 日 {time}',
      'hover.hintOpen': '悬停即预览，点左侧圆圈标记完成。',
      'hover.hintDone': '点左侧圆圈可以重新打开',
      'hover.dayTitle': '{month} 月 {day} 日',
      'hover.dayCount': '{count} 条记录',
      'hover.dayEmpty': '这一天没有记录。',
      'hover.more': '还有 {count} 条。',
      'hover.hintDay': '点这一天查看完整记录。',
      'hover.rel.today': '今天',
      'hover.rel.tomorrow': '明天',
      'hover.rel.yesterday': '昨天',
      'hover.rel.overdue': '逾期 {days} 天',
      'hover.rel.soon': '还有 {days} 天',
      'side.today': '今天 · {month} 月 {day} 日',
      'side.count': '{count} 项',
      'side.empty': '今天没有安排',
      'side.overdue': '逾期',
      'side.allDay': '全天',
      'side.openTotal': '共 {count} 项待办',
      'side.doneToday': '今天完成 {count} 项',
      'side.hint': '点击打开任务面板',
      'list.notified': '已提醒',
      'settings.gear': '提醒设置',
      'settings.title': '到点提醒',
      'settings.close': '收起',
      'settings.enabled': '开启提醒（推送到手机飞书）',
      'settings.webhook': '飞书 webhook',
      'settings.webhookPlaceholder': 'https://open.feishu.cn/open-apis/bot/v2/hook/…',
      'settings.secret': '签名密钥（可选）',
      'settings.secretPlaceholder': '机器人开了「签名校验」才需要',
      'settings.save': '保存',
      'settings.test': '发送测试',
      'settings.saved': '已保存。',
      'settings.sent': '测试消息已发送，看看手机上的飞书。',
      'settings.enabledOn': '提醒已开启，到点会推送到飞书。',
      'settings.enabledOff': '提醒已关闭，到点不再推送。',
      'settings.autoComplete': '推送后自动标记完成',
      'settings.autoCompleteHint': '到点提醒发出去之后，这条任务就算做完了，不用再回来点一下。',
      'settings.autoOn': '到点推送后会自动完成。',
      'settings.autoOff': '到点只推送，不会自动完成。',
      'settings.unsaved': 'webhook / 密钥有改动还没保存，点「保存」才生效。',
      'settings.hint': '只有同时填了日期和时间的待办才会提醒；没写时间的任务不提醒。提醒在到点后 6 小时内有效，错过太久的只记录不推送。',
      'settings.guide': '使用说明',
      'welcome.title': '欢迎使用「任务」',
      'welcome.lead': '三件事，一分钟就能上手。',
      'welcome.step1Title': '① 记下要做的事',
      'welcome.step1Body': '在输入框写标题就行，日期默认今天、时间默认往后最近的 5 分钟。要提醒的课或会，把时间改准。',
      'welcome.step2Title': '② 侧栏悬停看今天',
      'welcome.step2Body': '鼠标放到侧栏「任务」图标上，直接看今天要做什么，不用点开面板。',
      'welcome.step3Title': '③ 到点提醒到手机',
      'welcome.step3Body': '填一个飞书群机器人 webhook，任务到点就推到你手机上的飞书。',
      'welcome.howTitle': '怎么拿飞书 webhook',
      'welcome.howBody': '在飞书群里点右上角「…」→ 设置 → 群机器人 → 添加机器人 → 自定义机器人，复制 webhook 地址；如果勾了「签名校验」，把密钥也一起复制。',
      'welcome.later': '稍后再说',
      'welcome.configure': '去配置提醒',
      'welcome.close': '关闭',
    }

    const EN = {
      'panel.title': 'Tasks',
      'panel.subtitle': '{open} open · {done} finished today',
      'panel.subtitleEmpty': 'Note what to do, then look back by day',
      'tab.todo': 'To do',
      'tab.calendar': 'Calendar',
      'compose.placeholder': 'Add something to do…',
      'compose.due': 'Due',
      'compose.time': 'Time',
      'compose.clearDue': 'No date',
      'compose.add': 'Add',
      'panel.back': 'Back',
      'list.open': 'Open',
      'list.done': 'Done',
      'list.empty': 'Nothing open. Add a task above.',
      'list.emptyDone': 'Nothing finished yet.',
      'list.overdue': 'Overdue',
      'list.today': 'Today',
      'list.due': 'Due {date}',
      'list.fromAgent': 'from the assistant',
      'list.auto': 'auto',
      'list.autoTitle': 'Closed automatically when the reminder was delivered',
      'list.delete': 'Delete',
      'list.reopen': 'Reopen',
      'calendar.prev': 'Previous month',
      'calendar.next': 'Next month',
      'calendar.today': 'Today',
      'calendar.month': '{month}/{year}',
      'calendar.weekday.0': 'M',
      'calendar.weekday.1': 'T',
      'calendar.weekday.2': 'W',
      'calendar.weekday.3': 'T',
      'calendar.weekday.4': 'F',
      'calendar.weekday.5': 'S',
      'calendar.weekday.6': 'S',
      'calendar.dayTitle': '{month}/{day}',
      'calendar.dayEmpty': 'Nothing recorded on this day.',
      'calendar.hint': 'Pick any day to see what happened then.',
      'event.created': 'Added',
      'event.completed': 'Finished',
      'event.autoCompleted': 'auto-done',
      'event.reopened': 'Reopened',
      'event.updated': 'Edited',
      'event.deleted': 'Deleted',
      'state.loading': 'Loading…',
      'state.failed': 'Could not load: {message}',
      'state.retry': 'Retry',
      'hover.due': 'Due',
      'hover.source': 'Source',
      'hover.sourceUser': 'Me',
      'hover.sourceAgent': 'Assistant',
      'hover.session': 'Session',
      'hover.created': 'Created',
      'hover.completed': 'Finished',
      'hover.auto': 'Closed by',
      'hover.autoValue': 'the reminder, automatically',
      'hover.stamp': '{month}/{day} {time}',
      'hover.hintOpen': 'Hover to preview · click the circle to finish',
      'hover.hintDone': 'Click the circle to reopen',
      'hover.dayTitle': '{month}/{day}',
      'hover.dayCount': '{count} entries',
      'hover.dayEmpty': 'Nothing recorded on this day',
      'hover.more': '{count} more…',
      'hover.hintDay': 'Click the day for the full log',
      'hover.rel.today': 'today',
      'hover.rel.tomorrow': 'tomorrow',
      'hover.rel.yesterday': 'yesterday',
      'hover.rel.overdue': '{days}d overdue',
      'hover.rel.soon': 'in {days}d',
      'side.today': 'Today · {month}/{day}',
      'side.count': '{count} items',
      'side.empty': 'Nothing planned today',
      'side.overdue': 'Overdue',
      'side.allDay': 'All day',
      'side.openTotal': '{count} open',
      'side.doneToday': '{count} done today',
      'side.hint': 'Click to open the task panel',
      'list.notified': 'Reminded',
      'settings.gear': 'Reminders',
      'settings.title': 'Reminders',
      'settings.close': 'Close',
      'settings.enabled': 'Remind me on my phone (Feishu)',
      'settings.webhook': 'Feishu webhook',
      'settings.webhookPlaceholder': 'https://open.feishu.cn/open-apis/bot/v2/hook/…',
      'settings.secret': 'Signing secret (optional)',
      'settings.secretPlaceholder': 'Only if the bot has signature checks on',
      'settings.save': 'Save',
      'settings.test': 'Send a test',
      'settings.saved': 'Saved.',
      'settings.sent': 'Test message sent — check Feishu on your phone.',
      'settings.enabledOn': 'Reminders are on — they will land in Feishu when a task comes due.',
      'settings.enabledOff': 'Reminders are off — nothing will be pushed.',
      'settings.autoComplete': 'Close the task once it is pushed',
      'settings.autoCompleteHint': 'When the reminder goes out, the task counts as done — no need to come back and tick it.',
      'settings.autoOn': 'A delivered reminder will mark the task done.',
      'settings.autoOff': 'Reminders push only; the task stays open.',
      'settings.unsaved': 'The webhook or secret changed but is not saved yet; press Save to apply it.',
      'settings.hint': 'Only tasks with BOTH a date and a time are reminded; a date alone stays silent. A reminder stays valid for six hours after its time — anything older is marked as handled without a push.',
      'settings.guide': 'How it works',
      'welcome.title': 'Welcome to Tasks',
      'welcome.lead': 'Three things, one minute to get going.',
      'welcome.step1Title': '① Write down what to do',
      'welcome.step1Body': 'Type a title — the date defaults to today and the clock to the next five-minute mark. For a class or a meeting, set the exact time.',
      'welcome.step2Title': '② Hover the sidebar for today',
      'welcome.step2Body': 'Rest the pointer on the Tasks icon in the sidebar to see today at a glance without opening the panel.',
      'welcome.step3Title': '③ Get a reminder on your phone',
      'welcome.step3Body': 'Add a Feishu group-bot webhook and each task is pushed to Feishu on your phone when its time comes.',
      'welcome.howTitle': 'Where to find the Feishu webhook',
      'welcome.howBody': 'In a Feishu group open "…" → Settings → Group bots → Add bot → Custom bot, then copy the webhook URL. If signature checks are on, copy the secret too.',
      'welcome.later': 'Maybe later',
      'welcome.configure': 'Set up reminders',
      'welcome.close': 'Close',
    }

    function interpolate(template, params) {
      if (!params) return template
      return template.replace(/\{(\w+)\}/g, (whole, key) =>
        Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole,
      )
    }

    function call(op, extra) {
      return fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op, ...(extra || {}) }),
      }).then(
        (response) =>
          response
            .json()
            .catch(() => null)
            .then((payload) => {
              if (!payload || payload.ok !== true) {
                const reason = payload && payload.error && payload.error.message
                throw new Error(reason || `HTTP ${response.status}`)
              }
              return payload.value
            }),
        (error) => {
          throw new Error(error && error.message ? error.message : String(error))
        },
      )
    }

    /* ---------- dates (local calendar days, never UTC) ---------- */

    const pad2 = (value) => String(value).padStart(2, '0')
    const ymd = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

    function dayOf(iso) {
      const date = new Date(iso)
      return Number.isFinite(date.getTime()) ? ymd(date) : ''
    }

    function clockOf(iso) {
      const date = new Date(iso)
      return Number.isFinite(date.getTime()) ? `${pad2(date.getHours())}:${pad2(date.getMinutes())}` : ''
    }

    // A new task's clock starts at "now", nudged to the next five-minute mark so
    // the default is never already in the past (a slot that has passed reminds
    // immediately).
    const SLOT_MS = 5 * 60 * 1000

    function nextSlotClock(date) {
      const at = Math.ceil((date.getTime() + 60 * 1000) / SLOT_MS) * SLOT_MS
      const next = new Date(at)
      return `${pad2(next.getHours())}:${pad2(next.getMinutes())}`
    }

    function monthCells(year, month) {
      const first = new Date(year, month, 1)
      const offset = (first.getDay() + 6) % 7
      const cells = []
      for (let index = 0; index < 42; index += 1) {
        const date = new Date(year, month, index - offset + 1)
        cells.push({ key: ymd(date), day: date.getDate(), month: date.getMonth(), inMonth: date.getMonth() === month })
      }
      return cells
    }

    const KIND_COLOR = {
      created: 'var(--dsw-alias-brand-primary)',
      completed: 'var(--dsw-alias-state-success-primary)',
      reopened: 'var(--dsw-alias-state-warn-primary)',
      updated: 'var(--dsw-alias-state-idle-primary)',
      deleted: 'var(--dsw-alias-state-error-primary)',
    }

    // A completion the reminder performed reads differently from a click.
    function eventLabel(event, t) {
      if (event.kind === 'completed' && event.auto) return t('event.autoCompleted')
      return t(`event.${event.kind}`)
    }

    /* ---------- data ---------- */

    function useTasks() {
      const [state, setState] = useState({ status: 'loading', tasks: [], events: [], error: null })
      const alive = useRef(true)

      const load = useCallback(
        () =>
          call('list').then(
            (value) => {
              if (!alive.current) return
              setState({ status: 'ready', tasks: (value && value.tasks) || [], events: (value && value.events) || [], error: null })
            },
            (error) => {
              if (!alive.current) return
              setState((prev) => ({ ...prev, status: 'error', error: error.message }))
            },
          ),
        [],
      )

      useEffect(() => {
        alive.current = true
        load()
        const timer = setInterval(load, 15000)
        return () => {
          alive.current = false
          clearInterval(timer)
        }
      }, [load])

      const mutate = useCallback(
        (op, extra) =>
          call(op, extra).then(
            (value) => load().then(() => value),
            (error) => load().then(() => Promise.reject(error)),
          ),
        [load],
      )

      return { state, load, mutate }
    }

    /* ---------- small pieces ---------- */

    function Icon(props) {
      const size = typeof props.size === 'number' ? props.size : 20
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M9.5 4h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1' }),
        h('rect', { x: 7.5, y: 2.4, width: 5, height: 3.2, rx: 1.1, fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M7.6 11.2l2.1 2.1 4.1-4.6', strokeWidth: 1.9 }),
        h('path', { d: 'M7.6 17.4l2.1 2.1 4.1-4.6', strokeWidth: 1.9, opacity: 0.55 }),
      )
    }

    function BellIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 16
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M12 3.2a5 5 0 0 0-5 5v3.1c0 .8-.3 1.6-.9 2.2L5 14.8h14l-1.1-1.3a3.3 3.3 0 0 1-.9-2.2V8.2a5 5 0 0 0-5-5z' }),
        h('path', { d: 'M9.9 18a2.2 2.2 0 0 0 4.2 0' }),
      )
    }

    function Check(props) {
      return h(
        'span',
        { className: 'dsht-check', 'data-checked': props.checked ? 'true' : 'false' },
        props.checked
          ? h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: 'M20 6L9 17l-5-5' }))
          : null,
      )
    }

    function DueChip(props) {
      const today = ymd(new Date())
      const overdue = props.due < today && !props.done
      const isToday = props.due === today
      const clock = props.time ? ` ${props.time}` : ''
      const label = `${props.t('list.due', { date: props.due.slice(5) })}${clock}`
      const text = overdue ? `${props.t('list.overdue')} · ${label}` : isToday ? `${props.t('list.today')}${clock}` : label
      return h('span', { className: 'dsht-due', 'data-tone': overdue ? 'overdue' : isToday ? 'today' : 'plain' }, text)
    }

    /* ---------- hover preview ---------- */

    function dueRelative(due, t) {
      const today = ymd(new Date())
      const days = Math.round((new Date(`${due}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
      if (days === 0) return t('hover.rel.today')
      if (days === 1) return t('hover.rel.tomorrow')
      if (days === -1) return t('hover.rel.yesterday')
      if (days < 0) return t('hover.rel.overdue', { days: -days })
      return t('hover.rel.soon', { days })
    }

    function stampOf(iso, t) {
      if (!iso) return ''
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return ''
      return t('hover.stamp', { month: date.getMonth() + 1, day: date.getDate(), time: clockOf(iso) })
    }

    function rows(entries) {
      return entries.map(([label, value]) =>
        h(
          'div',
          { className: 'dsht-hc-row', key: label },
          h('span', { className: 'dsht-hc-key' }, label),
          h('span', { className: 'dsht-hc-val' }, value),
        ),
      )
    }

    function TaskCard(props) {
      const { task, t } = props
      const entries = []
      const clock = task.time ? ` ${task.time}` : ''
      if (task.due) entries.push([t('hover.due'), `${task.due}${clock} · ${dueRelative(task.due, t)}`])
      else if (task.time) entries.push([t('hover.due'), task.time])
      entries.push([t('hover.source'), task.source === 'agent' ? t('hover.sourceAgent') : t('hover.sourceUser')])
      if (task.sessionId) entries.push([t('hover.session'), task.sessionId.slice(0, 8)])
      if (task.createdAt) entries.push([t('hover.created'), stampOf(task.createdAt, t)])
      if (task.completedAt) entries.push([t('hover.completed'), stampOf(task.completedAt, t)])
      if (task.autoCompleted) entries.push([t('hover.auto'), t('hover.autoValue')])

      return h(
        'div',
        { className: 'dsht-hc' },
        h('div', { className: 'dsht-hc-title' }, task.title),
        task.note ? h('div', { className: 'dsht-hc-note' }, task.note) : null,
        h('div', { className: 'dsht-hc-rows' }, rows(entries)),
        h('div', { className: 'dsht-hc-hint' }, task.status === 'done' ? t('hover.hintDone') : t('hover.hintOpen')),
      )
    }

    function DayCard(props) {
      const { day, events, t } = props
      const date = new Date(`${day}T00:00:00`)
      const shown = events.slice(0, 6)
      return h(
        'div',
        { className: 'dsht-hc' },
        h(
          'div',
          { className: 'dsht-hc-head' },
          h('span', { className: 'dsht-hc-title' }, t('hover.dayTitle', { month: date.getMonth() + 1, day: date.getDate() })),
          h('span', { className: 'dsht-hc-count' }, t('hover.dayCount', { count: events.length })),
        ),
        events.length === 0
          ? h('div', { className: 'dsht-hc-empty' }, t('hover.dayEmpty'))
          : h(
              'ul',
              { className: 'dsht-hc-list' },
              shown.map((event) =>
                h(
                  'li',
                  { key: event.id },
                  h('span', { className: 'dsht-when' }, clockOf(event.at)),
                  h('span', { className: 'dsht-kind', style: { color: KIND_COLOR[event.kind] } }, eventLabel(event, t)),
                  event.time ? h('span', { className: 'dsht-at' }, event.time) : null,
                  h('span', { className: 'dsht-hc-item' }, event.title),
                ),
              ),
            ),
        events.length > shown.length ? h('div', { className: 'dsht-hc-more' }, t('hover.more', { count: events.length - shown.length })) : null,
        h('div', { className: 'dsht-hc-hint' }, t('hover.hintDay')),
      )
    }

    // Agenda shown when hovering the sidebar icon: what is on for today,
    // plus anything already overdue so nothing quietly drops off.
    function TodayCard(props) {
      const { t } = props
      const { tasks, events } = props.data()
      const today = ymd(new Date())
      const date = new Date()
      const byClock = (a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99')
      const open = tasks.filter((task) => task.status === 'open')
      const overdue = open.filter((task) => task.due && task.due < today).sort((a, b) => (a.due + (a.time ?? '99:99')).localeCompare(b.due + (b.time ?? '99:99')))
      const dueToday = open.filter((task) => task.due === today).sort(byClock)
      const doneToday = events.filter((event) => event.kind === 'completed' && dayOf(event.at) === today).length
      const count = overdue.length + dueToday.length

      const row = (task, showDate) =>
        h(
          'li',
          { key: task.id, 'data-overdue': showDate ? 'true' : 'false' },
          h('span', { className: 'dsht-when' }, showDate ? task.due.slice(5) : task.time || t('side.allDay')),
          h('span', { className: 'dsht-hc-item' }, task.title),
        )

      return h(
        'div',
        { className: 'dsht-hc dsht-hc-today' },
        h(
          'div',
          { className: 'dsht-hc-head' },
          h('span', { className: 'dsht-hc-title' }, t('side.today', { month: date.getMonth() + 1, day: date.getDate() })),
          h('span', { className: 'dsht-hc-count' }, t('side.count', { count })),
        ),
        count === 0
          ? h('div', { className: 'dsht-hc-empty' }, t('side.empty'))
          : h(
              'ul',
              { className: 'dsht-hc-list' },
              overdue.map((task) => row(task, true)),
              dueToday.map((task) => row(task, false)),
            ),
        h(
          'div',
          { className: 'dsht-hc-hint' },
          `${t('side.openTotal', { count: open.length })}${doneToday ? ` · ${t('side.doneToday', { count: doneToday })}` : ''} · ${t('side.hint')}`,
        ),
      )
    }

    // One floating preview for the whole panel. The state lives at module scope
    // because the shell re-renders (and sometimes remounts) the sidebar button:
    // with per-component state an open card would be dropped mid-hover, so
    // components subscribe to this little store instead.
    const HOVER_DELAY = 150
    let hoverCard = null
    let hoverShowTimer = 0
    let hoverHideTimer = 0
    const hoverListeners = new Set()

    function clearHoverTimers() {
      clearTimeout(hoverShowTimer)
      clearTimeout(hoverHideTimer)
    }

    function publishHover(next) {
      hoverCard = next
      for (const listener of hoverListeners) listener()
    }

    // `show(element, payload)` arms a short delay so sweeping across a list does
    // not flash cards; `hide` gives the pointer a moment to reach the card's
    // neighbourhood before the card goes away.
    function showHover(element, payload, delay, owner) {
      clearHoverTimers()
      if (!element || typeof element.getBoundingClientRect !== 'function') return
      const box = element.getBoundingClientRect()
      const rect = { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
      hoverShowTimer = setTimeout(() => publishHover({ rect, payload, owner }), delay)
    }

    function hideHover() {
      clearHoverTimers()
      if (!hoverCard) return
      hoverHideTimer = setTimeout(() => publishHover(null), 70)
    }

    function hideHoverNow() {
      clearHoverTimers()
      if (hoverCard) publishHover(null)
    }

    function useHover(delay = HOVER_DELAY) {
      const [, bump] = useState(0)
      const owner = useMemo(() => ({}), [])

      useEffect(() => {
        const listener = () => bump((value) => value + 1)
        hoverListeners.add(listener)
        const onScroll = () => hideHoverNow()
        const onKey = (event) => {
          if (event.key === 'Escape') hideHoverNow()
        }
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onScroll)
        window.addEventListener('keydown', onKey)
        return () => {
          hoverListeners.delete(listener)
          window.removeEventListener('scroll', onScroll, true)
          window.removeEventListener('resize', onScroll)
          window.removeEventListener('keydown', onKey)
        }
      }, [])

      const api = useMemo(
        () => ({
          show: (element, payload) => showHover(element, payload, delay, owner),
          hide: hideHover,
          hideNow: hideHoverNow,
        }),
        [delay, owner],
      )

      // Only the view that opened the card renders it; every other mounted view
      // (the always-present sidebar entry included) stays quiet.
      return { card: hoverCard && hoverCard.owner === owner ? hoverCard : null, ...api }
    }

    function HoverCard(props) {
      const { card } = props
      const ref = useRef(null)
      const [place, setPlace] = useState(null)

      useLayoutEffect(() => {
        if (!card) {
          setPlace(null)
          return
        }
        const node = ref.current
        if (!node) return
        const box = node.getBoundingClientRect()
        const gap = 12
        const width = box.width || 300
        const height = box.height || 140
        let top = card.rect.top
        let left = card.rect.right + gap
        if (left + width > window.innerWidth - gap) {
          // No room on the right (a full-width list row): drop below the row and
          // stay inside the panel instead of flipping over the sidebar.
          left = Math.min(Math.max(gap, card.rect.left), window.innerWidth - width - gap)
          top = card.rect.bottom + gap
          if (top + height > window.innerHeight - gap) top = card.rect.top - height - gap
        }
        if (top + height > window.innerHeight - gap) top = window.innerHeight - height - gap
        if (top < gap) top = gap
        if (left < gap) left = gap
        if (left + width > window.innerWidth - gap) left = window.innerWidth - width - gap
        setPlace({ left: Math.round(left), top: Math.round(top) })
      }, [card])

      if (!card) return null
      const payload = card.payload
      const body =
        payload.kind === 'task'
          ? h(TaskCard, { task: payload.task, t: payload.t })
          : payload.kind === 'today'
            ? h(TodayCard, { data: payload.data, t: payload.t })
            : h(DayCard, { day: payload.day, events: payload.events, t: payload.t })

      return createPortal(
        h(
          'div',
          {
            className: 'dsht-hovercard',
            role: 'tooltip',
            ref,
            style: place ? { left: `${place.left}px`, top: `${place.top}px` } : { left: '-9999px', top: '0px' },
          },
          body,
        ),
        document.body,
      )
    }

    /* ---------- to-do view ---------- */

    function TodoView(props) {
      const { t, state, mutate } = props
      const [title, setTitle] = useState('')
      // A new task is due today unless the user picks another day; the date
      // field stays editable, and the clear button drops the due date
      // entirely for the "someday" kind of note. The clock starts at the next
      // five-minute mark so "now" is a ready-made default.
      const [due, setDue] = useState(() => ymd(new Date()))
      const [time, setTime] = useState(() => nextSlotClock(new Date()))
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(null)
      const [showDone, setShowDone] = useState(true)
      const hover = useHover()
      const hoverTask = (task) => ({
        onMouseEnter: (event) => hover.show(event.currentTarget, { kind: 'task', task, t }),
        onMouseLeave: hover.hide,
      })

      const open = state.tasks.filter((task) => task.status === 'open')
      const done = state.tasks.filter((task) => task.status === 'done')

      const run = (op, extra) => {
        if (busy) return
        setBusy(true)
        setError(null)
        mutate(op, extra)
          .catch((failure) => setError(failure.message))
          .then(() => setBusy(false))
      }

      const submit = (event) => {
        event.preventDefault()
        const text = title.trim()
        if (!text) return
        setTitle('')
        run('add', { title: text, due: due || null, time: due && time ? time : null })
        setDue(ymd(new Date()))
        setTime(nextSlotClock(new Date()))
      }

      return h(
        'div',
        { className: 'dsht-body' },
        h(
          'form',
          { className: 'dsht-compose', onSubmit: submit },
          h('input', {
            className: 'dsht-input',
            value: title,
            placeholder: t('compose.placeholder'),
            onChange: (event) => setTitle(event.target.value),
            'aria-label': t('compose.placeholder'),
          }),
          h('input', {
            className: 'dsht-date',
            type: 'date',
            value: due,
            title: t('compose.due'),
            'aria-label': t('compose.due'),
            onChange: (event) => {
              const next = event.target.value
              setDue(next)
              if (!next) setTime('')
              else if (!time) setTime(nextSlotClock(new Date()))
            },
          }),
          due
            ? h(
                'button',
                {
                  className: 'dsht-clear',
                  type: 'button',
                  title: t('compose.clearDue'),
                  'aria-label': t('compose.clearDue'),
                  onClick: () => {
                    setDue('')
                    setTime('')
                  },
                },
                '×',
              )
            : null,
          h('input', {
            className: 'dsht-date dsht-time',
            type: 'time',
            value: time,
            disabled: !due,
            title: t('compose.time'),
            'aria-label': t('compose.time'),
            onChange: (event) => setTime(event.target.value),
          }),
          h('button', { className: 'dsht-primary', type: 'submit', disabled: busy || !title.trim() }, t('compose.add')),
        ),
        error ? h('div', { className: 'dsht-error', role: 'alert' }, error) : null,
        h(
          'div',
          { className: 'dsht-section' },
          h('div', { className: 'dsht-section-head' }, h('span', null, t('list.open')), h('span', { className: 'dsht-count' }, open.length)),
          open.length === 0
            ? h('div', { className: 'dsht-empty' }, t('list.empty'))
            : h(
                'ul',
                { className: 'dsht-list' },
                open.map((task) =>
                  h(
                    'li',
                    { className: 'dsht-item', key: task.id, ...hoverTask(task) },
                    h(
                      'button',
                      {
                        className: 'dsht-checkbtn',
                        type: 'button',
                        title: t('event.completed'),
                        'aria-label': t('event.completed'),
                        onClick: () => run('complete', { id: task.id }),
                      },
                      h(Check, { checked: false }),
                    ),
                    h(
                      'div',
                      { className: 'dsht-item-main' },
                      h('div', { className: 'dsht-item-title' }, task.title),
                      h(
                        'div',
                        { className: 'dsht-meta' },
                        task.due ? h(DueChip, { t, due: task.due, time: task.time, done: false }) : null,
                        !task.due && task.time ? h('span', { className: 'dsht-due' }, task.time) : null,
                        task.note ? h('span', { className: 'dsht-note' }, task.note) : null,
                        task.source === 'agent' ? h('span', { className: 'dsht-tag' }, t('list.fromAgent')) : null,
                        task.notifiedAt ? h('span', { className: 'dsht-tag dsht-notified', title: clockOf(task.notifiedAt) }, t('list.notified')) : null,
                      ),
                    ),
                    h(
                      'button',
                      {
                        className: 'dsht-ghost',
                        type: 'button',
                        title: t('list.delete'),
                        'aria-label': t('list.delete'),
                        onClick: () => run('remove', { id: task.id }),
                      },
                      '×',
                    ),
                  ),
                ),
              ),
        ),
        h(
          'div',
          { className: 'dsht-section' },
          h(
            'button',
            { className: 'dsht-section-head dsht-toggle', type: 'button', onClick: () => setShowDone(!showDone) },
            h('span', null, showDone ? '▾' : '▸', t('list.done')),
            h('span', { className: 'dsht-count' }, done.length),
          ),
          showDone
            ? done.length === 0
              ? h('div', { className: 'dsht-empty' }, t('list.emptyDone'))
              : h(
                  'ul',
                  { className: 'dsht-list' },
                  done.slice(0, 40).map((task) =>
                    h(
                      'li',
                      { className: 'dsht-item', 'data-done': 'true', key: task.id, ...hoverTask(task) },
                      h(
                        'button',
                        {
                          className: 'dsht-checkbtn',
                          type: 'button',
                          title: t('list.reopen'),
                          'aria-label': t('list.reopen'),
                          onClick: () => run('reopen', { id: task.id }),
                        },
                        h(Check, { checked: true }),
                      ),
                      h(
                        'div',
                        { className: 'dsht-item-main' },
                        h('div', { className: 'dsht-item-title' }, task.title),
                        h(
                          'div',
                          { className: 'dsht-meta' },
                          task.completedAt ? h('span', { className: 'dsht-when' }, clockOf(task.completedAt)) : null,
                          task.autoCompleted
                            ? h('span', { className: 'dsht-tag dsht-auto', title: t('list.autoTitle') }, t('list.auto'))
                            : null,
                          task.due ? h(DueChip, { t, due: task.due, time: task.time, done: true }) : null,
                        ),
                      ),
                    ),
                  ),
                )
            : null,
        ),
        h(HoverCard, { card: hover.card }),
      )
    }

    /* ---------- calendar view ---------- */

    function CalendarView(props) {
      const { t, state } = props
      const now = new Date()
      const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
      const [selected, setSelected] = useState(ymd(now))
      const hover = useHover(120)

      const byDay = useMemo(() => {
        const map = new Map()
        for (const event of state.events) {
          const day = dayOf(event.at)
          if (!day) continue
          if (!map.has(day)) map.set(day, [])
          map.get(day).push(event)
        }
        return map
      }, [state.events])

      const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor])
      const today = ymd(now)
      const dayEvents = byDay.get(selected) || []
      const selectedDate = new Date(`${selected}T00:00:00`)

      const shift = (delta) => {
        const next = new Date(cursor.year, cursor.month + delta, 1)
        setCursor({ year: next.getFullYear(), month: next.getMonth() })
      }

      return h(
        'div',
        { className: 'dsht-body' },
        h(
          'div',
          { className: 'dsht-cal-head' },
          h('div', { className: 'dsht-cal-title' }, t('calendar.month', { year: cursor.year, month: cursor.month + 1 })),
          h(
            'div',
            { className: 'dsht-cal-nav' },
            h('button', { className: 'dsht-ghost', type: 'button', title: t('calendar.prev'), 'aria-label': t('calendar.prev'), onClick: () => shift(-1) }, '‹'),
            h(
              'button',
              {
                className: 'dsht-ghost dsht-today',
                type: 'button',
                onClick: () => {
                  const date = new Date()
                  setCursor({ year: date.getFullYear(), month: date.getMonth() })
                  setSelected(ymd(date))
                },
              },
              t('calendar.today'),
            ),
            h('button', { className: 'dsht-ghost', type: 'button', title: t('calendar.next'), 'aria-label': t('calendar.next'), onClick: () => shift(1) }, '›'),
          ),
        ),
        h(
          'div',
          { className: 'dsht-weekdays' },
          [0, 1, 2, 3, 4, 5, 6].map((index) => h('span', { key: index }, t(`calendar.weekday.${index}`))),
        ),
        h(
          'div',
          { className: 'dsht-grid' },
          cells.map((cell) => {
            const events = byDay.get(cell.key) || []
            const kinds = []
            for (const event of events) {
              if (!kinds.includes(event.kind)) kinds.push(event.kind)
            }
            const completed = events.filter((event) => event.kind === 'completed').length
            return h(
              'button',
              {
                type: 'button',
                key: cell.key,
                className: 'dsht-cell',
                'data-out': cell.inMonth ? 'false' : 'true',
                'data-today': cell.key === today ? 'true' : 'false',
                'data-sel': cell.key === selected ? 'true' : 'false',
                onMouseEnter: (event) => hover.show(event.currentTarget, { kind: 'day', day: cell.key, events, t }),
                onMouseLeave: hover.hide,
                onClick: () => setSelected(cell.key),
              },
              h('span', { className: 'dsht-daynum' }, cell.day),
              h(
                'span',
                { className: 'dsht-dots' },
                kinds.slice(0, 4).map((kind) => h('span', { key: kind, className: 'dsht-dot', style: { background: KIND_COLOR[kind] } })),
                events.length > 4 ? h('span', { className: 'dsht-more' }, `+${events.length - 4}`) : null,
              ),
              completed > 0 ? h('span', { className: 'dsht-daycount' }, completed) : null,
            )
          }),
        ),
        h(
          'div',
          { className: 'dsht-day' },
          h(
            'div',
            { className: 'dsht-day-head' },
            h('span', null, t('calendar.dayTitle', { month: selectedDate.getMonth() + 1, day: selectedDate.getDate() })),
            h('span', { className: 'dsht-count' }, dayEvents.length),
          ),
          dayEvents.length === 0
            ? h('div', { className: 'dsht-empty' }, t('calendar.dayEmpty'))
            : h(
                'ul',
                { className: 'dsht-day-list' },
                dayEvents.map((event) =>
                  h(
                    'li',
                    { key: event.id, className: 'dsht-day-item' },
                    h('span', { className: 'dsht-when' }, clockOf(event.at)),
                    h('span', { className: 'dsht-kind', style: { color: KIND_COLOR[event.kind] } }, eventLabel(event, t)),
                    event.time ? h('span', { className: 'dsht-at' }, event.time) : null,
                    h('span', { className: 'dsht-day-title' }, event.title),
                  ),
                ),
              ),
        ),
        h(HoverCard, { card: hover.card }),
      )
    }

    /* ---------- first-run guide ---------- */

    const WELCOME_STEPS = [
      ['welcome.step1Title', 'welcome.step1Body'],
      ['welcome.step2Title', 'welcome.step2Body'],
      ['welcome.step3Title', 'welcome.step3Body'],
    ]

    function Welcome({ t, onClose, onConfigure }) {
      useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [onClose])

      const card = h(
        'div',
        { className: 'dsht-modal-mask', onClick: (event) => { if (event.target === event.currentTarget) onClose() } },
        h(
          'div',
          { className: 'dsht-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('welcome.title') },
          h(
            'div',
            { className: 'dsht-modal-head' },
            h('div', { className: 'dsht-modal-title' }, t('welcome.title')),
            h(
              'button',
              { className: 'dsht-x', type: 'button', onClick: onClose, title: t('welcome.close'), 'aria-label': t('welcome.close') },
              '×',
            ),
          ),
          h('p', { className: 'dsht-modal-lead' }, t('welcome.lead')),
          h(
            'ol',
            { className: 'dsht-steps' },
            WELCOME_STEPS.map(([title, body]) =>
              h(
                'li',
                { className: 'dsht-step', key: title },
                h('div', { className: 'dsht-step-title' }, t(title)),
                h('div', { className: 'dsht-step-body' }, t(body)),
              ),
            ),
          ),
          h(
            'div',
            { className: 'dsht-how' },
            h('div', { className: 'dsht-how-title' }, t('welcome.howTitle')),
            h('div', { className: 'dsht-how-body' }, t('welcome.howBody')),
          ),
          h(
            'div',
            { className: 'dsht-modal-actions' },
            h('button', { className: 'dsht-ghost', type: 'button', onClick: onClose }, t('welcome.later')),
            h('button', { className: 'dsht-primary', type: 'button', onClick: onConfigure }, t('welcome.configure')),
          ),
        ),
      )
      return typeof document === 'undefined' ? card : createPortal(card, document.body)
    }

    /* ---------- reminder settings ---------- */

    function SettingsCard({ t, onClose, onSaved, onHelp }) {
      const [form, setForm] = useState({ enabled: false, webhook: '', secret: '', autoComplete: true })
      const [status, setStatus] = useState({ kind: 'idle', text: '' })
      const [busy, setBusy] = useState(false)
      const [dirty, setDirty] = useState(false)
      const alive = useRef(true)

      useEffect(() => {
        alive.current = true
        call('settings').then(
          (value) => {
            if (!alive.current || !value) return
            setForm({
              enabled: Boolean(value.enabled),
              webhook: value.webhook || '',
              secret: value.secret || '',
              autoComplete: value.autoComplete !== false,
            })
            if (value.lastError) setStatus({ kind: 'error', text: value.lastError })
          },
          () => undefined,
        )
        return () => {
          alive.current = false
        }
      }, [])

      const patch = (next) => setForm((prev) => ({ ...prev, ...next }))

      const persist = async () => {
        setBusy(true)
        try {
          const value = await call('saveSettings', {
            enabled: form.enabled,
            webhook: form.webhook,
            secret: form.secret,
            autoComplete: form.autoComplete,
          })
          if (value) {
            setForm({
              enabled: Boolean(value.enabled),
              webhook: value.webhook || '',
              secret: value.secret || '',
              autoComplete: value.autoComplete !== false,
            })
          }
          setDirty(false)
          setStatus({ kind: 'ok', text: t('settings.saved') })
          if (onSaved) onSaved(value)
          return true
        } catch (error) {
          setStatus({ kind: 'error', text: error.message })
          return false
        } finally {
          if (alive.current) setBusy(false)
        }
      }

      // The switch saves on its own, webhook included: expecting people to flip
      // it and then also press Save is exactly how "enabled: false" gets stored
      // by mistake after the field was already filled in.
      const toggleEnabled = async (next) => {
        patch({ enabled: next })
        setBusy(true)
        try {
          const value = await call('saveSettings', { enabled: next, webhook: form.webhook, secret: form.secret, autoComplete: form.autoComplete })
          if (!alive.current) return
          setForm((prev) => ({ ...prev, enabled: value ? Boolean(value.enabled) : next }))
          setDirty(false)
          setStatus({ kind: 'ok', text: next ? t('settings.enabledOn') : t('settings.enabledOff') })
          if (onSaved) onSaved(value)
        } catch (error) {
          if (!alive.current) return
          setForm((prev) => ({ ...prev, enabled: !next }))
          setStatus({ kind: 'error', text: error.message })
        } finally {
          if (alive.current) setBusy(false)
        }
      }

      // Same deal as the reminder switch: a toggle that needs a second click on
      // Save is a toggle people think they already set.
      const toggleAutoComplete = async (next) => {
        patch({ autoComplete: next })
        setBusy(true)
        try {
          const value = await call('saveSettings', { autoComplete: next })
          if (!alive.current) return
          setForm((prev) => ({ ...prev, autoComplete: value ? value.autoComplete !== false : next }))
          setStatus({ kind: 'ok', text: next ? t('settings.autoOn') : t('settings.autoOff') })
          if (onSaved) onSaved(value)
        } catch (error) {
          if (!alive.current) return
          setForm((prev) => ({ ...prev, autoComplete: !next }))
          setStatus({ kind: 'error', text: error.message })
        } finally {
          if (alive.current) setBusy(false)
        }
      }

      const test = async () => {
        if (!(await persist())) return
        setBusy(true)
        try {
          await call('testNotify')
          setStatus({ kind: 'ok', text: t('settings.sent') })
        } catch (error) {
          setStatus({ kind: 'error', text: error.message })
        } finally {
          if (alive.current) setBusy(false)
        }
      }

      return h(
        'section',
        { className: 'dsht-settings' },
        h(
          'div',
          { className: 'dsht-settings-head' },
          h('div', { className: 'dsht-settings-title' }, t('settings.title')),
          h(
            'button',
            { className: 'dsht-x', type: 'button', onClick: onClose, title: t('settings.close'), 'aria-label': t('settings.close') },
            '×',
          ),
        ),
        h(
          'label',
          { className: 'dsht-toggle' },
          h('input', {
            type: 'checkbox',
            checked: form.enabled,
            onChange: (event) => void toggleEnabled(Boolean(event.target.checked)),
          }),
          h('span', null, t('settings.enabled')),
        ),
        h(
          'label',
          { className: 'dsht-toggle' },
          h('input', {
            type: 'checkbox',
            checked: form.autoComplete,
            onChange: (event) => void toggleAutoComplete(Boolean(event.target.checked)),
          }),
          h('span', null, t('settings.autoComplete')),
        ),
        h('div', { className: 'dsht-hint dsht-hint-slim' }, t('settings.autoCompleteHint')),
        h(
          'label',
          { className: 'dsht-field' },
          h('span', { className: 'dsht-field-label' }, t('settings.webhook')),
          h('input', {
            className: 'dsht-input',
            type: 'url',
            value: form.webhook,
            placeholder: t('settings.webhookPlaceholder'),
            spellCheck: false,
            onChange: (event) => {
              patch({ webhook: event.target.value })
              setDirty(true)
            },
          }),
        ),
        h(
          'label',
          { className: 'dsht-field' },
          h('span', { className: 'dsht-field-label' }, t('settings.secret')),
          h('input', {
            className: 'dsht-input',
            type: 'password',
            value: form.secret,
            placeholder: t('settings.secretPlaceholder'),
            spellCheck: false,
            onChange: (event) => {
              patch({ secret: event.target.value })
              setDirty(true)
            },
          }),
        ),
        h(
          'div',
          { className: 'dsht-settings-actions' },
          h('button', { className: 'dsht-primary', type: 'button', disabled: busy, onClick: persist }, t('settings.save')),
          h('button', { className: 'dsht-ghost', type: 'button', disabled: busy, onClick: test }, t('settings.test')),
        ),
        status.kind === 'error'
          ? h('div', { className: 'dsht-error', role: 'alert' }, status.text)
          : status.kind === 'ok'
            ? h('div', { className: 'dsht-ok' }, status.text)
            : null,
        dirty ? h('div', { className: 'dsht-warn' }, t('settings.unsaved')) : null,
        h('div', { className: 'dsht-hint' }, t('settings.hint')),
        onHelp
          ? h('button', { className: 'dsht-link', type: 'button', onClick: onHelp }, t('settings.guide'))
          : null,
      )
    }

    /* ---------- panel ---------- */

    function Panel(props) {
      const { t } = props
      const { state, load, mutate } = useTasks()
      const [view, setView] = useState('todo')
      const [settingsOpen, setSettingsOpen] = useState(false)
      const [welcome, setWelcome] = useState(false)
      const asked = useRef(false)

      // Show the guide once per install: the host remembers that it was seen, so
      // reinstalling the panel in another window does not nag again.
      useEffect(() => {
        if (asked.current) return
        asked.current = true
        call('settings').then(
          (value) => {
            if (value && !value.onboarded) setWelcome(true)
          },
          () => undefined,
        )
      }, [])

      const closeWelcome = useCallback(() => {
        setWelcome(false)
        call('saveSettings', { onboarded: true }).catch(() => undefined)
      }, [])

      const openReminderSettings = useCallback(() => {
        setWelcome(false)
        setSettingsOpen(true)
      }, [])

      const today = ymd(new Date())
      const openCount = state.tasks.filter((task) => task.status === 'open').length
      const doneToday = state.events.filter((event) => event.kind === 'completed' && dayOf(event.at) === today).length

      if (state.status === 'loading') {
        return h('div', { className: 'dsht-root' }, h('div', { className: 'dsht-inner' }, h('div', { className: 'dsht-empty' }, t('state.loading'))))
      }

      if (state.status === 'error' && state.tasks.length === 0) {
        return h(
          'div',
          { className: 'dsht-root' },
          h(
            'div',
            { className: 'dsht-inner' },
            h('div', { className: 'dsht-error', role: 'alert' }, t('state.failed', { message: state.error || '' })),
            h('button', { className: 'dsht-primary', type: 'button', onClick: () => load() }, t('state.retry')),
          ),
        )
      }

      return h(
        'div',
        { className: 'dsht-root' },
        h(
          'div',
          { className: 'dsht-inner' },
          h(
            'div',
            { className: 'dsht-head' },
            h(
              'div',
              { className: 'dsht-headline' },
              props.onBack
                ? h(
                    'button',
                    {
                      className: 'dsht-back',
                      type: 'button',
                      onClick: props.onBack,
                      title: t('panel.back'),
                      'aria-label': t('panel.back'),
                    },
                    '←',
                    h('span', null, t('panel.back')),
                  )
                : null,
              h(
                'div',
                null,
                h('div', { className: 'dsht-title' }, t('panel.title')),
                h('div', { className: 'dsht-sub' }, openCount || doneToday ? t('panel.subtitle', { open: openCount, done: doneToday }) : t('panel.subtitleEmpty')),
              ),
            ),
            h(
              'div',
              { className: 'dsht-head-tools' },
              h(
                'div',
                { className: 'dsht-tabs', role: 'tablist' },
                h('button', { className: 'dsht-tab', type: 'button', role: 'tab', 'data-active': view === 'todo' ? 'true' : 'false', onClick: () => setView('todo') }, t('tab.todo')),
                h('button', { className: 'dsht-tab', type: 'button', role: 'tab', 'data-active': view === 'calendar' ? 'true' : 'false', onClick: () => setView('calendar') }, t('tab.calendar')),
              ),
              h(
                'button',
                {
                  className: 'dsht-gear',
                  type: 'button',
                  'data-active': settingsOpen ? 'true' : 'false',
                  title: t('settings.gear'),
                  'aria-label': t('settings.gear'),
                  'aria-expanded': settingsOpen ? 'true' : 'false',
                  onClick: () => setSettingsOpen((open) => !open),
                },
                h(BellIcon, { size: 16 }),
              ),
            ),
          ),
          settingsOpen ? h(SettingsCard, { t, onClose: () => setSettingsOpen(false), onSaved: () => load(), onHelp: () => { setSettingsOpen(false); setWelcome(true) } }) : null,
          view === 'todo' ? h(TodoView, { t, state, mutate, reload: load }) : h(CalendarView, { t, state }),
        ),
        welcome ? h(Welcome, { t, onClose: closeWelcome, onConfigure: openReminderSettings }) : null,
      )
    }

    /* ---------- sidebar entry ---------- */

    const EMPTY_AGENDA = { tasks: [], events: [] }

    // Module-level so a remount (theme switch, sidebar relayout) keeps the last
    // agenda instead of flashing an empty card, while a state mirror makes the
    // open card re-render once fresh data lands.
    let AGENDA = EMPTY_AGENDA

    // The sidebar button keeps a light cache of the list so hovering it can
    // answer "what's on today?" without opening the panel.
    function SidebarEntry(props) {
      const { t, size, active } = props
      const [, setAgenda] = useState(AGENDA)
      const lastLoad = useRef(0)
      const alive = useRef(true)
      const anchor = useRef(null)
      const hover = useHover(240)

      const load = useCallback((force) => {
        const now = Date.now()
        if (!force && now - lastLoad.current < 4000) return
        lastLoad.current = now
        call('list').then(
          (value) => {
            if (!alive.current) return
            AGENDA = { tasks: (value && value.tasks) || [], events: (value && value.events) || [] }
            setAgenda(AGENDA)
          },
          () => undefined,
        )
      }, [])

      useEffect(() => {
        alive.current = true
        load(true)
        const timer = setInterval(() => load(true), 60000)
        return () => {
          alive.current = false
          clearInterval(timer)
        }
      }, [load])

      const enter = (event) => {
        load(true)
        // Anchor on the whole sidebar row so the card clears the sidebar instead
        // of covering the neighbouring entries.
        const target = event.currentTarget
        const anchor = (target && typeof target.closest === 'function' && target.closest('button')) || target
        hover.show(anchor, { kind: 'today', data: () => AGENDA, t })
      }

      // The shell wraps this entry in its own button and only the button's own
      // padding belongs to it, so a React enter on our span can miss: watch
      // document-level mouse moves and open the card whenever the pointer is
      // anywhere on that button. `inside` keeps one show per visit.
      useEffect(() => {
        const node = anchor.current
        if (!node || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return
        let inside = false
        const buttonFor = (target) => {
          const element = target && target.nodeType === 1 ? target : target && target.parentElement
          const button = element && typeof element.closest === 'function' ? element.closest('button') : null
          return button && typeof button.contains === 'function' && button.contains(node) ? button : null
        }
        const onOver = (event) => {
          const button = buttonFor(event.target)
          if (!button) {
            if (inside) {
              inside = false
              hover.hide()
            }
            return
          }
          if (inside) return
          inside = true
          load(true)
          hover.show(button, { kind: 'today', data: () => AGENDA, t })
        }
        document.addEventListener('mouseover', onOver, true)
        return () => document.removeEventListener('mouseover', onOver, true)
      }, [hover.show, hover.hide, load, t])

      return h(
        'span',
        { className: 'dsht-side', ref: anchor, onMouseEnter: enter, onMouseLeave: hover.hide },
        h(Icon, { size, active }),
        h(HoverCard, { card: hover.card }),
      )
    }

    /* ---------- styles ---------- */

    const CSS = `
.dsht-root{height:100%;overflow:auto;box-sizing:border-box;padding:26px 30px 44px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.5}
.dsht-inner{max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.dsht-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.dsht-title{font-size:20px;font-weight:600;letter-spacing:.2px}
.dsht-sub{margin-top:4px;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.dsht-tabs{display:inline-flex;gap:2px;padding:3px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1)}
.dsht-tab{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;padding:5px 14px;border-radius:7px;cursor:pointer}
.dsht-tab[data-active="true"]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.1)}
.dsht-body{display:flex;flex-direction:column;gap:16px}
.dsht-compose{display:flex;align-items:center;gap:8px;padding:7px 8px 7px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:11px;background:var(--dsw-alias-bg-layer-1)}
.dsht-compose:focus-within{border-color:var(--dsw-alias-border-l2)}
.dsht-input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:13.5px;padding:6px 2px}
.dsht-date{border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;padding:4px 6px;outline:0}
.dsht-date:disabled{opacity:.42}
.dsht-clear{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:14px;line-height:1;padding:3px 5px;border-radius:6px;cursor:pointer}
.dsht-clear:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsht-headline{display:flex;align-items:center;gap:10px;min-width:0}
.dsht-back{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;padding:4px 9px;cursor:pointer;white-space:nowrap}
.dsht-back:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsht-time{width:104px}
.dsht-side{display:inline-flex;align-items:center}
.dsht-at{font-variant-numeric:tabular-nums;font-size:10.5px;color:var(--dsw-alias-label-secondary);padding:0 5px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);white-space:nowrap}
.dsht-primary{border:0;border-radius:8px;padding:7px 15px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font:inherit;font-size:13px;font-weight:500;cursor:pointer}
.dsht-primary:hover:not(:disabled){filter:brightness(.93)}
.dsht-primary:disabled{opacity:.45;cursor:default}
.dsht-section{display:flex;flex-direction:column;gap:8px}
.dsht-section-head{display:flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
.dsht-toggle{border:0;background:transparent;font:inherit;padding:0;cursor:pointer;color:var(--dsw-alias-label-secondary)}
.dsht-count{font-size:11px;padding:1px 7px;border-radius:99px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);letter-spacing:0}
.dsht-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.dsht-item{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
.dsht-item[data-done="true"]{opacity:.62}
.dsht-checkbtn{border:0;background:transparent;padding:2px;margin-top:1px;cursor:pointer;color:var(--dsw-alias-label-secondary);display:flex}
.dsht-check{display:flex;align-items:center;justify-content:center;width:17px;height:17px;border-radius:50%;border:1.6px solid var(--dsw-alias-border-l2);box-sizing:border-box;color:transparent}
.dsht-check[data-checked="true"]{background:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary);color:#fff}
.dsht-item-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.dsht-item-title{font-size:13.5px;overflow-wrap:anywhere}
.dsht-item[data-done="true"] .dsht-item-title{text-decoration:line-through;text-decoration-color:var(--dsw-alias-border-l2)}
.dsht-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.dsht-due{padding:1px 7px;border-radius:99px;border:1px solid var(--dsw-alias-border-l1);font-size:11px}
.dsht-due[data-tone="overdue"]{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.dsht-due[data-tone="today"]{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.dsht-tag{padding:1px 7px;border-radius:99px;background:var(--dsw-alias-bg-layer-2);font-size:10.5px}
.dsht-note{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:360px}
.dsht-ghost{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;padding:2px 7px;border-radius:6px;cursor:pointer;line-height:1.2}
.dsht-ghost:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsht-empty{padding:16px 14px;border:1px dashed var(--dsw-alias-border-l1);border-radius:10px;color:var(--dsw-alias-label-secondary);font-size:12.5px;text-align:center}
.dsht-error{padding:9px 12px;border-radius:9px;border:1px solid var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);font-size:12.5px}
.dsht-head-tools{display:flex;align-items:center;gap:8px}
.dsht-gear{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsht-gear:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsht-gear[data-active="true"]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}
.dsht-settings{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.dsht-settings-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dsht-settings-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dsht-x{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:15px;line-height:1;padding:3px 6px;border-radius:6px;cursor:pointer}
.dsht-x:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsht-toggle{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dsw-alias-label-primary);cursor:pointer}
.dsht-toggle input{accent-color:var(--dsw-alias-brand-primary)}
.dsht-field{display:flex;flex-direction:column;gap:5px}
.dsht-field-label{font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.dsht-input{width:100%;box-sizing:border-box;padding:7px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px}
.dsht-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsht-settings-actions{display:flex;align-items:center;gap:8px}
.dsht-ok{font-size:12.5px;color:var(--dsw-alias-state-success-primary)}
.dsht-hint{font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
.dsht-warn{font-size:11.5px;line-height:1.5;color:var(--dsw-alias-state-warn-primary)}
.dsht-notified{color:var(--dsw-alias-state-success-primary)}
.dsht-auto{color:var(--dsw-alias-brand-primary)}
.dsht-hint-slim{margin:-6px 0 0 24px}
.dsht-link{border:0;background:transparent;padding:0;text-align:left;font:inherit;font-size:11.5px;color:var(--dsw-alias-brand-primary);cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.dsht-modal-mask{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.42);animation:dsht-fade .12s ease-out}
@keyframes dsht-fade{from{opacity:0}to{opacity:1}}
.dsht-modal{width:min(480px,100%);max-height:calc(100vh - 48px);overflow:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;padding:20px 22px;border-radius:14px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 24px 60px -18px rgba(0,0,0,.6);font-size:13px;line-height:1.55}
.dsht-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dsht-modal-title{font-size:15px;font-weight:600}
.dsht-modal-lead{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px}
.dsht-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.dsht-step{display:flex;flex-direction:column;gap:3px;padding:10px 12px;border-radius:10px;background:var(--dsw-alias-bg-layer-2)}
.dsht-step-title{font-weight:600;font-size:12.5px}
.dsht-step-body{color:var(--dsw-alias-label-secondary);font-size:12.5px}
.dsht-how{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border-radius:10px;border:1px dashed var(--dsw-alias-border-l2)}
.dsht-how-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dsht-how-body{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dsht-modal-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:2px}
.dsht-hovercard{position:fixed;z-index:2147483000;max-width:330px;min-width:190px;padding:11px 13px;border-radius:11px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 12px 32px -10px rgba(0,0,0,.45);pointer-events:none;font-size:12.5px;line-height:1.45;animation:dsht-hc-in .12s ease-out}
@keyframes dsht-hc-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
.dsht-hc{display:flex;flex-direction:column;gap:8px}
.dsht-hc-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.dsht-hc-title{font-size:13.5px;font-weight:600;overflow-wrap:anywhere}
.dsht-hc-count{font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.dsht-hc-note{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere;max-height:130px;overflow:hidden}
.dsht-hc-rows{display:flex;flex-direction:column;gap:3px}
.dsht-hc-row{display:flex;gap:10px;align-items:baseline}
.dsht-hc-key{flex:0 0 auto;min-width:44px;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.dsht-hc-val{flex:1;min-width:0;overflow-wrap:anywhere}
.dsht-hc-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}
.dsht-hc-list li{display:flex;align-items:baseline;gap:7px;min-width:0}
.dsht-hc-item{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-hc-more,.dsht-hc-empty{font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.dsht-hc-hint{margin-top:2px;padding-top:7px;border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-label-secondary)}
.dsht-hc-today .dsht-hc-list li .dsht-when{min-width:0}
.dsht-hc-today .dsht-hc-list li[data-overdue="true"] .dsht-when{color:var(--dsw-alias-state-error-primary)}
.dsht-cal-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dsht-cal-title{font-size:15px;font-weight:600}
.dsht-cal-nav{display:flex;align-items:center;gap:2px}
.dsht-cal-nav .dsht-ghost{font-size:16px;padding:2px 9px}
.dsht-today{font-size:12px!important;border:1px solid var(--dsw-alias-border-l1)!important;border-radius:7px;margin:0 4px}
.dsht-weekdays{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;font-size:11px;color:var(--dsw-alias-label-secondary);text-align:center;padding:0 1px}
.dsht-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.dsht-cell{position:relative;min-height:70px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:6px 7px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;cursor:pointer;text-align:left}
.dsht-cell:hover{border-color:var(--dsw-alias-border-l2)}
.dsht-cell[data-out="true"]{opacity:.36}
.dsht-cell[data-today="true"]{border-color:var(--dsw-alias-brand-primary)}
.dsht-cell[data-sel="true"]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.dsht-daynum{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dsht-cell[data-today="true"] .dsht-daynum{color:var(--dsw-alias-brand-primary);font-weight:600}
.dsht-dots{display:flex;gap:3px;flex-wrap:wrap;align-items:center}
.dsht-dot{width:6px;height:6px;border-radius:50%}
.dsht-more{font-size:9px;color:var(--dsw-alias-label-secondary)}
.dsht-daycount{position:absolute;right:6px;bottom:5px;font-size:10px;color:var(--dsw-alias-state-success-primary)}
.dsht-day{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:11px;background:var(--dsw-alias-bg-layer-1)}
.dsht-day-head{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.dsht-day-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.dsht-day-item{display:flex;align-items:baseline;gap:10px;font-size:13px}
.dsht-when{font-variant-numeric:tabular-nums;font-size:11.5px;color:var(--dsw-alias-label-secondary);min-width:38px}
.dsht-kind{font-size:11px;min-width:44px}
.dsht-day-title{overflow-wrap:anywhere}
@media (max-width:640px){.dsht-root{padding:16px 14px 32px}.dsht-cell{min-height:52px;padding:4px 5px;gap:4px}}
`

    /* ---------- stylesheet ---------- */

    // A static plugin gets no `styles` facility, so the sheet is a plain
    // <style> element in the document head, removed with the plugin.
    const STYLE_ID = 'dsh-tasks-panel-styles'

    function installStyles() {
      let stopped = false

      const applyTo = (doc) => {
        if (!doc || !doc.head || !doc.getElementById) return
        if (doc.getElementById(STYLE_ID)) return
        const style = doc.createElement('style')
        style.id = STYLE_ID
        style.textContent = CSS
        doc.head.appendChild(style)
      }

      applyTo(document)
      // The shell may swap documents; keep a fresh one covered.
      const timer = setInterval(() => {
        if (!stopped) applyTo(document)
      }, 3000)

      return () => {
        stopped = true
        clearInterval(timer)
        const existing = document.getElementById(STYLE_ID)
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing)
      }
    }

    return {
      name: 'dsh-tasks-panel',
      inject: ['slots', 'locale', 'layout'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('dsh-tasks-panel', { zh: ZH, en: EN }), 'dsh-tasks-panel: dictionaries')
        const bound = ctx.locale.bind('dsh-tasks-panel')
        const t = (key, params) => {
          const template = bound(key)
          return interpolate(typeof template === 'string' ? template : key, params)
        }

        ctx.effect(() => installStyles(), 'dsh-tasks-panel: styles')
        // Remember the panel the user was on before opening Tasks so the back
        // button can return there (null means the Conversation). `panelInfo` is
        // the layout store the shell itself navigates through; it is not part of
        // the catalogued layout service, hence the defensive probes.
        let layout
        try {
          layout = typeof ctx.get === 'function' ? ctx.get('layout') : undefined
        } catch {
          layout = undefined
        }
        if (!layout) layout = ctx.layout

        const panelInfo = layout && layout.panelInfo
        let backTarget = null
        if (panelInfo && typeof panelInfo.getSnapshot === 'function') {
          const read = () => {
            const snapshot = panelInfo.getSnapshot()
            return snapshot ? snapshot.activePanelId ?? null : null
          }
          const initial = read()
          if (initial !== 'tasks') backTarget = initial
          if (typeof panelInfo.subscribe === 'function') {
            ctx.effect(
              () =>
                panelInfo.subscribe(() => {
                  const next = read()
                  if (next !== 'tasks') backTarget = next
                }),
              'dsh-tasks-panel: remember previous panel',
            )
          }
        }

        const canGoBack = Boolean(layout && typeof layout.selectPanel === 'function')

        const goBack = () => {
          if (!layout || typeof layout.selectPanel !== 'function') return
          try {
            layout.selectPanel(backTarget)
          } catch {
            try {
              layout.selectPanel(null)
            } catch {
              /* the Conversation key is always registered; nothing to do */
            }
          }
        }

        ctx.effect(
          () =>
            ctx.slots.inject('sidebar.panellist', () =>
              ctx.slots.register(
                {
                  name: 'sidebar.panellist',
                  id: 'tasks',
                  order: 30,
                  label: () => t('panel.title'),
                  locale: 'dsh-tasks-panel',
                },
                (props) => h(SidebarEntry, { ...props, t }),
              ),
            ),
          'dsh-tasks-panel: sidebar entry',
        )

        ctx.effect(
          () =>
            ctx.slots.inject('main', () =>
              ctx.slots.register({ name: 'main', key: 'tasks', locale: 'dsh-tasks-panel' }, (props) =>
                h(Panel, { ...props, t, onBack: canGoBack ? goBack : undefined }),
              ),
            ),
          'dsh-tasks-panel: main panel',
        )

      },
    }
  },
})
