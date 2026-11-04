# dsh-tasks-panel

[![test](https://github.com/tortoise014/dsh-tasks-panel/actions/workflows/test.yml/badge.svg)](https://github.com/tortoise014/dsh-tasks-panel/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/dsh-tasks-panel.svg)](https://www.npmjs.com/package/dsh-tasks-panel)

A DeepSeek Harness sidebar plugin: a personal to-do list plus a month calendar of
what happened on each day.

## Install

```
plugin_manager install_bundle target:"dsh-tasks-panel"
```

or install a local checkout with `target:"<absolute path to this folder>"`. The
first time the Tasks panel opens it shows a short guide (write a task, hover the
sidebar for today, paste a Feishu webhook for reminders).

- **Sidebar entry** `Tasks` → main panel with two views.
- **To do** — add / complete / reopen / delete tasks. A new task is due today by
  default, the date field changes that, and `×` clears it for undated notes; the
  clock starts at the next five-minute mark (so "now" is the default and never
  already in the past), and clearing the date clears it too.
- **Back** — the panel header carries a Back control that returns to whichever
  panel (a session, Plugins, Schedules, …) Tasks was opened from.
- **Today at a glance** — hovering the sidebar icon opens a floating agenda of
  today's tasks (with their times), anything overdue, and how much is still open,
  so checking the day costs no click.
- **Calendar** — every task event (added, finished, reopened, edited, deleted) is
  drawn on the month grid; click a day to read that day's log.
- **Hover preview** — pointing at a task (or a calendar day) opens a floating card
  with the full title, note, due date and time, source, session and timestamps,
  so nothing needs a click; Esc or scrolling dismisses it. Cards clear their anchor:
  beside narrow targets (calendar cells, the sidebar icon) and below full-width
  rows so they never cover the sidebar.
- **Agent tool** `task_write` — the assistant adds and completes tasks through the
  same operations as the UI, so the panel and the agent never diverge. It takes
  `due` (YYYY-MM-DD) and `time` (HH:mm) too: an appointment like "class at 18:30"
  keeps both.
- **Time-of-day reminders (Feishu)** — the bell button in the panel header opens
  the reminder settings: paste a Feishu group bot webhook (and the signing secret
  if the bot has signature checks on) and flip the switch. The switch saves by
  itself — webhook included — so there is no way to fill the form, leave the
  switch unticked and wonder why nothing arrives. *Send a test* proves the phone
  receives it. The host scans open tasks every 30 seconds and pushes
  `⏰ title / time / note` once per slot.
- **First-run guide** — the first time the panel opens on a fresh install it shows
  a modal that walks through the three things worth knowing (write a task, hover
  the sidebar for today, paste a webhook for reminders) and spells out where the
  Feishu webhook lives. *Maybe later* dismisses it, *Set up reminders* jumps
  straight to the settings card, and the settings card keeps a *How it works*
  link so the guide can be reopened. Dismissal is stored as `onboarded` in the
  `global` record, and switching reminders on marks it seen as well.

Reminders follow one rule: **a task is reminded only when it has both a date and
a time.** A date alone is a to-do for the day, not an appointment, so it stays
quiet. Each `${due}T${time}` slot is pushed at most once (`notifiedFor`), moving a
task to a new time re-arms it, and a slot that passed more than six hours ago is
marked as handled without a push so a sleeping laptop does not dump yesterday's
appointments. Last send time and the last Feishu error are kept in memory and
shown back in the settings card; `task_write` deliberately has no reminder action —
turning a push on is a user decision, not an agent one.

Data lives in the `dsh_tasks` storage domain (`tasks`, `events` tables plus a
`global` record holding the reminder settings); the browser half talks to
`POST /api/dsh-tasks-panel/op` on the host half.

`zod@3.25.76` is vendored under `node_modules/zod` because a bundle installed by
link (`"dsh-tasks-panel": "link:…"`) does not get its dependencies installed by
pnpm. An npm install pulls zod from the registry instead, so the published
tarball deliberately does not ship `node_modules`.

## Development

```bash
npm install     # zod for the host half, jsdom + react for the UI suite
npm test        # runs the three suites below in order
```

| suite | what it covers |
| --- | --- |
| `node test/host.mjs` (38 checks) | storage ops (`add`/`complete`/`reopen`/`update`/`remove`/`clearCompleted`), time normalisation, the HTTP-op surface, and the `task_write` tool |
| `node test/reminders.mjs` (26 checks) | Feishu scheduling: due detection, one push per slot, the six-hour grace window, signature signing, error reporting, the settings guard |
| `node test/ui.mjs` (57 checks) | the client half rendered in jsdom: slot registration, to-do rows, all three hover cards, the compose form's date/time defaults, the first-run guide, the reminder settings card |

Everything runs against the real bundle. The host suites import `index.js` with a
fake Cordis context and in-memory tables; the UI suite loads `client.js` through a
stand-in `window.__ModuleLoader__` and renders the panel into jsdom. No network:
the Feishu calls are a stub `fetch` that records the payload it would have sent.

GitHub Actions runs the same three suites on Node 20 and 22 for every push and
pull request — see `.github/workflows/test.yml`.
