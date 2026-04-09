<div align="center">

# Circle

**Local-first AI IDE with human-approved coding agents**

Edit code, inspect Git, run terminals, and collaborate with AI in one desktop workspace.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/tageecc/circle/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tageecc/circle/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/tageecc/circle?label=Latest)](https://github.com/tageecc/circle/releases)
[![Platforms](https://img.shields.io/badge/Platforms-macOS%20%7C%20Windows%20%7C%20Linux-6b7280)](#download)

[Download](#download) · [Why Circle](#why-circle) · [Quick Start](#quick-start) · [Core Features](#core-features) · [Roadmap](#roadmap)

[简体中文](./README.zh-CN.md)

</div>

---

## Preview

![Circle IDE Preview](./resources/preview-en.png)

---

## Why Circle

Circle is built for developers who want AI assistance without giving up control of their local workflow. It keeps the full loop in one place: code editing, Git, terminal, MCP tools, and AI collaboration.

- **One workspace, not five tabs**: editor, Git, terminal, AI chat, and review flow stay in the same window.
- **Human-in-the-loop by default**: review file edits and shell commands before they apply.
- **Local-first architecture**: workspace data, chat history, and vector indexes stay on your machine.
- **Bring your own models and tools**: configure provider credentials, choose models from the input box, and extend with MCP and Skills.

---

## Quick Start

### Download

Grab the latest installer from [GitHub Releases](https://github.com/tageecc/circle/releases):

- **Windows**: `circle-{version}-setup.exe`
- **macOS**: `circle-{version}-{arch}.dmg`
- **Linux**: `circle-{version}.AppImage` / `.deb`

### First Run

1. Open **Settings → Models** and add the provider credentials you want to use.
2. Open the model picker in the chat input and choose a model for the current conversation.
3. Open a local folder, clone a repository, or describe an app on the welcome page to generate a project.
4. Review AI file edits and shell commands before they execute.

### Run from Source

```bash
git clone https://github.com/tageecc/circle.git
cd circle
pnpm install
pnpm dev
```

### Build Packages

```bash
pnpm build:win
pnpm build:mac
pnpm build:linux
```

---

## Core Features

### AI-native coding workflow

- Generate a new project from natural language on the welcome page
- Stream AI conversations in the sidebar with tool calls and planning
- Use semantic codebase search backed by local vector indexing
- Choose models per conversation directly from the chat input
- Get inline ghost completion with a dedicated completion model

### Safe file and command execution

- Review AI file changes in a diff flow before keeping them
- Approve, reject, or skip risky terminal commands
- Track tool output and long-running execution directly in chat

### Full desktop development environment

- Monaco editor with TypeScript/JavaScript language services
- Integrated Git: status, commit, push, branch switching, diff, history, blame
- Real terminal powered by `node-pty`
- Problems panel for diagnostics and language-service feedback

### Extensible by design

- MCP server integration for external tools
- Skills mounted from user or workspace directories
- Built-in tools for search, grep, file operations, terminal commands, and more

### Local-first and private

- No required account system
- No hosted backend required
- Data and indexes stored locally with SQLite / LibSQL and `sqlite-vec`

---

## Tech Stack

| Domain   | Technology                                                                            |
| -------- | ------------------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Tailwind CSS, Radix/shadcn                                      |
| Desktop  | Electron, electron-vite                                                               |
| Editor   | Monaco Editor                                                                         |
| AI       | `@ai-sdk/provider` / `provider-utils`, native agent loops, multi-provider models, MCP |
| Data     | SQLite / LibSQL, Drizzle ORM, `sqlite-vec`                                            |
| Terminal | node-pty                                                                              |

---

## Roadmap

Near-term priorities:

- Remote SSH workspace support
- Multi-root workspace support
- Language-level debugger integration
- Better in-app help and documentation surfaces

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and PR guidelines.

- **Bug reports**: [Open an issue](../../issues)
- **Feature requests**: [Open an issue](../../issues)
- **Code contributions**: Fork → Branch → PR
- **Docs improvements**: PRs are welcome

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md). For security issues, see [SECURITY.md](SECURITY.md).

---

## License

[MIT License](LICENSE) © 2025 Circle

---

## Links

- [Releases](https://github.com/tageecc/circle/releases)
- [Changelog](CHANGELOG.md)
- [Security Policy](SECURITY.md)
- [Support](SUPPORT.md)
