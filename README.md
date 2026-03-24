# Circle

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-f69220.svg)](https://pnpm.io)
[![CI](https://github.com/tageecc/circle/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tageecc/circle/actions/workflows/ci.yml)

> **本地优先的 AI 原生桌面 IDE** — 在单一窗口内完成打开工程、编辑、终端、Git 与 AI 对话。

Circle 基于 **Electron**，数据与向量索引默认落在本机 **SQLite / LibSQL**，无需自建后端即可使用。

---

## Vibe coding IDE 能力清单

以下为「AI 辅助写代码的桌面 IDE」常见能力；**已实现的打勾**，部分实现或未做的已注明。

### 工程与工作区

- [x] 打开本地文件夹、最近项目列表
- [x] 从 Git 克隆仓库
- [x] 新建空文件夹项目
- [x] 欢迎页：用自然语言描述需求，**AI 生成并落盘完整工程**后自动打开
- [x] 多标签页编辑、关闭未保存提示
- [ ] 多根工作区（单窗口多文件夹）

### 编辑器

- [x] **Monaco** 代码编辑（主题、字体、缩进等与设置联动）
- [x] **TypeScript / JavaScript** 语言服务（诊断、补全、跳转等，随工程）
- [x] **Markdown** 与 **图片** 预览
- [x] **Diff** 视图（含 AI 修改文件时的对比确认流）
- [x] **AI 行内幽灵补全**（可关、可配专用模型；TS/JS 可选 Shadow 诊断）
- [x] 与列表补全分层：`quickSuggestions` 关闭，减少与行内建议冲突
- [x] **Git Blame** 行内装饰（可配）

### AI 与自动化

- [x] 侧栏 **流式对话**、工具调用、文件编辑 **Human-in-the-loop** 确认
- [x] **默认助手**：设置 → 模型（提供商、模型 ID、系统提示）
- [x] 对话输入框可 **切换 Agent**（取决于本地库中的 Agent 记录；`pnpm db:seed` 会写入多条示例）
- [x] **代码库语义索引**（Embedding + 状态栏进度；设置中配置）
- [x] **MCP** 与 **自定义工具**（设置 → MCP & Tools）
- [ ] 独立的「Agents 列表 / 创建 / 删除」全屏管理页（相关组件在仓库中尚未挂到主导航）

### 终端与诊断

- [x] 集成 **终端**（node-pty）
- [x] **问题**面板汇总诊断
- [x] 从 AI 工具流 **注入终端命令** 等（随工具实现）

### Git

- [x] 工作区状态、**提交**、**推送**、**拉取/获取**、**切换分支**、新建分支
- [x] **Diff**、**文件历史**、**Blame**、**分支对比**

### 账户与设置

- [x] 本地用户 **登录 / 登出**（用户菜单）
- [x] 设置：**通用、模型、MCP & Tools、外观、编辑器、终端、快捷键**
- [x] **全局 AI 用户规则**、Embedding、网页搜索 Key、**行内补全** 等
- [ ] 帮助菜单内「欢迎 / 文档 / 关于」仍为占位

### 其他

- [x] **`circle://` URL Scheme** 唤起应用（主进程协议注册）
- [ ] 远程 SSH 工作区
- [ ] 语言级调试器（断点、单步）

---

## 快速开始

### 环境

- Node.js **18+**
- **pnpm**（版本与 `package.json` 中 `packageManager` 一致）

### 安装与开发

```bash
pnpm install
pnpm dev
```

可选：复制 `.env.example` 为 `.env`（按需）。**主路径**是在应用内 **设置** 里配置模型与 API Key；索引、Apply Edit、搜索等也在设置中完成。

### 构建

```bash
pnpm build:win    # Windows
pnpm build:mac    # macOS
pnpm build:linux  # Linux
```

### 示例数据

首次可填充本地示例 Agent / MCP 等：

```bash
pnpm db:seed
```

---

## 使用提示

1. **用 AI 从零建项目**：无打开工程时，在欢迎页输入描述 → 选目录 → 等待生成 → 自动打开。
2. **日常开发**：打开文件夹 → 左侧文件树 + 中间编辑区 + 右侧对话；底部可开终端与问题面板。
3. **默认模型**：**设置 → 模型**；若执行过 `db:seed`，对话里还可切换其他本地 Agent 记录。

---

## 文档与协作

| 文档                                  | 说明         |
| ------------------------------------- | ------------ |
| [CHANGELOG](CHANGELOG.md)             | 版本记录     |
| [CONTRIBUTING](CONTRIBUTING.md)       | 开发、PR、CI |
| [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md) | 行为准则     |
| [SECURITY](SECURITY.md)               | 安全披露     |
| [SUPPORT](SUPPORT.md)                 | 获取帮助     |

### 建议：保护 `main` 分支

在 GitHub：**Settings → Rules → Rulesets**（或 **Branches → Branch protection rules**）中为 `main` 开启：

- Require a pull request before merging
- Require status checks to pass（至少包含 **CI / validate** 与 **build** 任务）

避免直接推主分支破坏 CI。

---

## 技术栈

- **UI**：React 19、TypeScript、Tailwind CSS、Radix / shadcn 风格组件
- **桌面**：Electron、electron-vite
- **数据**：SQLite / LibSQL、Drizzle ORM
- **AI**：Mastra、Vercel AI SDK、多模型提供商 SDK
- **编辑器**：Monaco Editor

---

## 贡献与许可

贡献前请阅读 **[CONTRIBUTING.md](CONTRIBUTING.md)** 与 **[CODE_OF_CONDUCT](CODE_OF_CONDUCT.md)**。

本项目以 **[MIT License](LICENSE)** 发布。

## 致谢

- [Mastra](https://mastra.ai/) — Agent / 工具编排
- [shadcn/ui](https://ui.shadcn.com/) — UI 组件实践
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — 编辑器内核
