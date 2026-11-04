# dsh-tasks-panel

[![test](https://github.com/tortoise014/dsh-tasks-panel/actions/workflows/test.yml/badge.svg)](https://github.com/tortoise014/dsh-tasks-panel/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/dsh-tasks-panel.svg)](https://www.npmjs.com/package/dsh-tasks-panel)

[English](README.md) | 中文

DeepSeek Harness 的侧栏插件：一个私人待办清单，加一个能回看「每天发生了什么」的月历。

## 安装

```
plugin_manager install_bundle target:"dsh-tasks-panel"
```

也可以用 `target:"<本文件夹的绝对路径>"` 装本地版本。第一次打开「任务」面板时会出现一个简短引导（写一条任务、悬停侧栏看今天、粘贴飞书 webhook 配提醒）。

- **侧栏入口**「任务」→ 主面板，两个视图。
- **待办** —— 添加 / 完成 / 重新打开 / 删除任务。新任务默认截止今天，日期框可以改，`×` 可以清空日期变成没有截止日的备忘；时间框默认落在「下一个 5 分钟整点」（所以默认既是"现在"、又不会一建出来就已经过期），清空日期时时间也一起清掉。
- **返回** —— 面板头部有「← 返回」，回到你进入「任务」之前所在的那个面板（某个会话、插件、自动化任务……）。
- **今天一眼看完** —— 鼠标悬停侧栏的「任务」图标，会浮出一张今日日程：今天的任务和它们的时刻、已逾期的事项、还有多少没完成，不用点开面板就能看到今天的安排。
- **日历** —— 每个任务事件（新增、完成、重新打开、编辑、删除）都会画在月网格上；点某一天就能看那天的完整记录。
- **悬停预览** —— 鼠标指向一条任务（或日历上的一天）就浮出卡片：完整标题、备注、截止日期和时间、来源、会话、时间戳，全程不用点；按 Esc 或滚动就消失。卡片会自动避让：窄目标（日历格、侧栏图标）放旁边，整行宽的目标放行下方，不会盖住侧栏。
- **Agent 工具 `task_write`** —— 助手通过和 UI 完全相同的操作来添加、完成任务，面板和助手不会各记一份。它也接受 `due`（YYYY-MM-DD）和 `time`（HH:mm）：像「下午六点半上课」这种约会，日期和时间都留得住。
- **到点提醒（飞书）** —— 面板头部的铃铛按钮打开提醒设置：粘贴飞书群机器人的 webhook（机器人开了签名校验就把密钥也填上），打开开关即可。开关是**自带保存**的（连 webhook 一起存），所以不会出现"填好了表单、忘了勾开关、然后纳闷为什么没消息"。「发送测试」能当场证明手机收得到。宿主每 30 秒扫描一次未完成任务，每个时段推送一条 `⏰ 标题 / 时间 / 备注`。
- **首次使用引导** —— 全新安装后第一次打开面板会弹出一个模态框，讲清三件值得知道的事（写一条任务、悬停侧栏看今天、粘贴 webhook 配提醒），并写明飞书 webhook 在哪儿拿。点「稍后再说」关掉，「去配置提醒」直接跳到设置卡，而设置卡里保留「使用说明」入口，随时能再打开。关闭状态存在 `global` 记录的 `onboarded` 字段里；把提醒开关打开也算"看过了"。

提醒只遵守一条规则：**同时有日期和时间的任务才提醒。** 只有日期的是"今天要做的事"，不是约会，所以保持安静。每个 `${due}T${time}` 时段最多推送一次（记在 `notifiedFor`），把任务改到新时间会重新武装；已经过去超过 6 小时的时段只标记为已处理、不补推，免得笔记本睡一晚起来把昨天的约会全倒给你。最近一次发送时间和最近一次飞书报错保存在内存里，会显示回设置卡；`task_write` 故意没有开关提醒的动作 —— 要不要推到你手机是用户自己的决定，不是助手的。

数据存在 `dsh_tasks` 存储域（`tasks`、`events` 两张表，另加一条 `global` 记录保存提醒设置）；浏览器半边通过宿主的 `POST /api/dsh-tasks-panel/op` 访问。

`zod@3.25.76` 以 vendored 形式放在 `node_modules/zod`，因为用 link 安装的 bundle（`"dsh-tasks-panel": "link:…"`）pnpm 不会给它装依赖。从 npm 安装时会正常从 registry 拉 zod，所以发布的 tarball 故意不带 `node_modules`。

## 开发

```bash
npm install     # 宿主半边的 zod，UI 测试用的 jsdom + react
npm test        # 依次跑下面三套
```

| 测试 | 覆盖什么 |
| --- | --- |
| `node test/host.mjs`（38 项） | 存储操作（`add`/`complete`/`reopen`/`update`/`remove`/`clearCompleted`）、时间规范化、HTTP op 接口、`task_write` 工具 |
| `node test/reminders.mjs`（26 项） | 飞书调度：到期判定、每个时段只推一次、6 小时宽限、签名、错误上报、设置校验 |
| `node test/ui.mjs`（57 项） | 在 jsdom 里渲染的浏览器半边：slot 注册、待办行、三种悬停卡、添加表单的日期/时间默认值、首次引导、提醒设置卡 |

全部对着真实的 bundle 跑。宿主套件用假的 Cordis context 和内存表 import `index.js`；UI 套件通过假的 `window.__ModuleLoader__` 加载 `client.js`，把面板渲染进 jsdom。全程不联网：飞书调用是打桩的 `fetch`，只记录它本来会发出去的 payload。

GitHub Actions 在每次 push 和 pull request 上用 Node 20 和 22 跑这同一套测试 —— 见 `.github/workflows/test.yml`。
