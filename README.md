<div align="center">

# Circle

**本地优先的 AI 原生桌面 IDE**

在单一窗口内完成编码、Git、终端与 AI 协作

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-f69220.svg)](https://pnpm.io)
[![CI](https://github.com/tageecc/circle/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tageecc/circle/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/tageecc/circle?label=Latest)](https://github.com/tageecc/circle/releases)

[下载](#下载) · [快速开始](#快速开始) · [核心特性](#核心特性) · [技术栈](#技术栈) · [路线图](#路线图)

</div>

---

## 简介

Circle 是一个基于 Electron 的本地桌面 IDE，将代码编辑、Git 工作流、终端与 AI 对话深度集成在同一界面。所有数据与向量索引存储在本地 SQLite / LibSQL，无需自建后端即可使用。

---

## 核心特性

### 🤖 AI 原生开发体验

- **自然语言生成工程**：欢迎页输入需求描述，AI 自动生成完整项目结构并落盘
- **行内幽灵补全**：支持专用模型配置、TS/JS Shadow 诊断、与列表补全分层
- **代码库语义索引**：Embedding 模型为对话提供精准上下文检索
- **Human-in-the-loop 确认**：AI 修改文件前双栏 Diff 对比，可接受或拒绝每处改动

### 🔧 完整的开发工具链

- **Monaco 编辑器**：TypeScript/JavaScript 语言服务、Markdown 预览、多标签管理
- **集成 Git**：工作区状态、提交、推送、分支切换、Diff、历史、Blame 可视化
- **真实终端**：node-pty 驱动的多 Tab Shell，支持 AI 工具注入命令并回传输出
- **问题面板**：汇总工作区诊断，语言服务实时反馈

### 🧩 可扩展的 AI 工具生态

- **MCP 协议**：配置外部 MCP 服务器，自动同步工具到对话
- **Skills**：在用户目录与工作区挂载技能说明，由助手按需拉取详情（渐进式披露）
- **内置工具集**：语义搜索、grep、文件操作、终端命令、网页搜索、任务列表等

### 🏠 本地优先与隐私

- **本地存储**：SQLite / LibSQL 保存业务数据与向量索引，无需云端依赖
- **多模型支持**：配置任意提供商（OpenAI / Anthropic / Google 等）的 API Key
- **离线可用**：编辑、Git、终端等核心功能无需网络

---

## 下载

### 预编译版本

前往 [GitHub Releases](https://github.com/tageecc/circle/releases) 下载适合你操作系统的安装包：

- **Windows**：`circle-{version}-setup.exe`
- **macOS**：`circle-{version}.dmg`
- **Linux**：`circle-{version}.AppImage` / `.deb` / `.snap`

> 首个正式版本即将发布。如需体验最新功能，请参考下方[快速开始](#快速开始)从源码构建。

---

## 路线图

**[x]** 已完成 · **[ ]** 规划中

### 工程与工作区

- [x] 打开本地文件夹、最近项目列表
- [x] 从 Git 克隆仓库
- [x] 新建空文件夹项目
- [x] 欢迎页：用自然语言描述需求，AI 生成并落盘完整工程后自动打开
- [x] 多标签页编辑、关闭未保存提示
- [ ] 多根工作区（单窗口多文件夹）

### 编辑器

- [x] Monaco 代码编辑（主题、字体、缩进等与设置联动）
- [x] TypeScript / JavaScript 语言服务（诊断、补全、跳转等，随工程）
- [x] Markdown 与 图片 预览
- [x] Diff 视图（含 AI 修改文件时的对比确认流）
- [x] AI 行内幽灵补全（可关、可配专用模型；TS/JS 可选 Shadow 诊断）
- [x] 与列表补全分层：quickSuggestions 关闭，减少与行内建议冲突
- [x] Git Blame 行内装饰（可配）

### AI 与自动化

- [x] 侧栏流式对话、工具调用、文件编辑 Human-in-the-loop 确认
- [x] 内置编码助手：逻辑在 `src/main/assistant/assistant.ts`；模型与系统提示在 **设置 → 模型** 配置
- [x] 代码库语义索引（Embedding + 状态栏进度；设置中配置）
- [x] MCP 与工具扩展（**设置 → MCP & Tools**）；Skills 面板管理技能启用与目录

### 终端与诊断

- [x] 集成 终端（node-pty）
- [x] 问题面板汇总诊断
- [x] 从 AI 工具流 注入终端命令 等（随工具实现）

### Git

- [x] 工作区状态、提交、推送、拉取/获取、切换分支、新建分支
- [x] Diff、文件历史、Blame、分支对比

### 设置与隐私

- [x] 无账号体系：数据与配置均在本地（SQLite / userData）
- [x] 设置：通用、模型、MCP、Skills、外观、编辑器、终端、快捷键
- [x] 全局 AI 用户规则、Embedding、行内补全等（模型 API 由用户自行配置）
- [x] 问题反馈写入本机 `userData/feedback`（不上传）
- [ ] 帮助菜单内「欢迎 / 文档 / 关于」仍为占位

### 其他

- [x] `circle://` URL Scheme 唤起应用（主进程协议注册）
- [ ] 远程 SSH 工作区
- [ ] 语言级调试器（断点、单步）

---

## 快速开始

### 前置要求

- **Node.js** 18+
- **pnpm**（与 `package.json` 中 `packageManager` 字段一致）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/tageecc/circle.git
cd circle

# 安装依赖
pnpm install

# 启动开发模式
pnpm dev
```

### 首次使用

1. **配置模型**：打开 **设置 → 模型**，输入 API Key 并选择提供商与模型 ID
2. **生成工程**：在欢迎页输入项目描述，AI 生成完整工程后自动打开
3. **日常开发**：左侧文件树、中间编辑器、右侧 AI 对话；底部终端与问题面板

### 构建打包

```bash
pnpm build:win    # Windows
pnpm build:mac    # macOS
pnpm build:linux  # Linux
```

---

## 技术栈

| 领域   | 技术                                                  |
| ------ | ----------------------------------------------------- |
| 前端   | React 19、TypeScript、Tailwind CSS、Radix / shadcn   |
| 桌面   | Electron、electron-vite                               |
| 编辑器 | Monaco Editor                                         |
| AI     | Vercel AI SDK（`ai` / `@ai-sdk/*`）、多提供商模型、MCP 协议 |
| 数据   | SQLite / LibSQL、Drizzle ORM                          |
| 终端   | node-pty                                              |

---

## 贡献

我们欢迎各种形式的贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解开发流程与 PR 规范。

- **Bug 报告**：[提交 Issue](../../issues)
- **功能建议**：[提交 Feature Request](../../issues)
- **代码贡献**：Fork → 开分支 → PR
- **文档改进**：直接提 PR 或 Issue

请遵守我们的 [行为准则](CODE_OF_CONDUCT.md)。安全问题请参阅 [SECURITY.md](SECURITY.md)。

---

## Star History

<a href="https://star-history.com/#tageecc/circle&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=tageecc/circle&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=tageecc/circle&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=tageecc/circle&type=Date" />
 </picture>
</a>

---

## 许可证

[MIT License](LICENSE) © 2025 Circle

---

## 链接

- [📥 下载安装包](https://github.com/tageecc/circle/releases)
- [📝 版本记录](CHANGELOG.md)
- [🔒 安全政策](SECURITY.md)
- [💬 获取帮助](SUPPORT.md)
