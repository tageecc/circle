# Circle

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-f69220.svg)](https://pnpm.io)

[![CI](https://github.com/tageecc/circle/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tageecc/circle/actions/workflows/ci.yml)

> AI-Powered Development Platform - 多 Agent 协作的智能开发平台

Circle 是一个基于 Electron 的多 Agent 平台，支持创建、管理和使用多个 AI Agent 来协助开发工作。

**开箱即用**：不依赖任何后端服务或用户本机环境。数据与向量索引均使用应用内置的本地 SQLite/LibSQL 存储。

## ✨ 核心特性

### 🤖 Coding Agent - AI 自动创建项目

受 Cursor 启发的 AI 编程助手，可以根据自然语言描述自动创建完整项目：

- **智能项目创建**：描述需求，AI 自动生成项目结构和代码
- **文件系统操作**：完整的文件读写、创建、删除能力
- **Human-in-the-Loop**：友好的用户交互，明确的文件夹选择流程
- **实时进度显示**：查看 AI 的创建过程

（在欢迎页输入需求并选择文件夹即可使用）

### 🎯 多 Agent 管理

- 创建和管理多个专业 Agent
- 每个 Agent 可配置不同的模型、参数和工具
- 支持 OpenAI、Anthropic、Google 等多种 AI 提供商

### 🔧 工具系统

- **MCP 工具**：集成 Model Context Protocol 工具
- **自定义工具**：创建自己的 JavaScript/TypeScript 工具
- **内置工具**：文件操作、Git 管理等内置功能

### 📝 代码编辑器

- Monaco Editor 集成
- 语法高亮和智能提示
- Markdown 预览
- 图片预览
- Git 集成

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm

### 配置

复制环境变量示例并重命名为 `.env`，至少填写一个 AI API Key 即可使用：

```bash
cp .env.example .env
```

- **数据与索引**：默认使用应用内置本地存储（SQLite/LibSQL），无需安装或配置任何数据库。
- **AI 与能力**：在应用内「设置 → 模型」中配置默认模型与 API Key；代码库索引、Apply Edit、网页搜索等均在设置中配置，不依赖环境变量。

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```

### 初始化数据库

首次运行时，可以填充示例数据：

```bash
$ pnpm db:seed
```

## 💡 使用示例

### 使用 Coding Agent 创建项目

1. 启动应用，在欢迎页面输入项目需求：

```
创建一个待办事项管理应用，使用 React + TypeScript + Tailwind CSS。
需要支持添加、删除、标记完成功能，并且数据要持久化到本地存储。
```

2. 点击发送，选择项目文件夹
3. AI 自动创建项目，实时显示进度
4. 完成后自动打开项目

### 创建自定义 Agent

1. 进入 Agents 页面
2. 点击「创建 Agent」
3. 配置名称、模型、提示词和工具
4. 保存并开始使用

## 📚 文档

以仓库内代码实现为准；使用方式见上方「快速开始」与「使用示例」。

| 文档                                  | 说明              |
| ------------------------------------- | ----------------- |
| [CHANGELOG](CHANGELOG.md)             | 版本与变更记录    |
| [CONTRIBUTING](CONTRIBUTING.md)       | 开发、PR、CI 约定 |
| [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md) | 社区行为准则      |
| [SECURITY](SECURITY.md)               | 安全漏洞披露      |
| [SUPPORT](SUPPORT.md)                 | 获取帮助的方式    |

## 🛠️ 技术栈

- **前端**：React 19 + TypeScript + Tailwind CSS
- **后端**：Electron + Node.js
- **数据库**：SQLite/LibSQL + Drizzle ORM
- **AI 框架**：Mastra + AI SDK
- **编辑器**：Monaco Editor
- **UI 组件**：Radix UI + shadcn/ui

## 🤝 贡献

欢迎提交 Issue 与 Pull Request。请先阅读 **[CONTRIBUTING.md](CONTRIBUTING.md)**（含本地校验命令与 PR 约定），并遵守 **[行为准则](CODE_OF_CONDUCT.md)**。

## 📄 许可证

本项目以 **[MIT License](LICENSE)** 发布。

## 🙏 致谢

- [Cursor](https://cursor.sh/) - Coding Agent 的灵感来源
- [Mastra](https://mastra.ai/) - AI Agent 框架
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库
