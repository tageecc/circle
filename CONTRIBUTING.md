# Contributing to Circle

Thank you for your interest in improving Circle. This document is the single source of truth for **how we collaborate** in this repository.

[中文摘要](#中文摘要) · [Development setup](#development-setup) · [Pull requests](#pull-requests) · [CI](#continuous-integration)

---

## 中文摘要

- 请先阅读 **[行为准则](CODE_OF_CONDUCT.md)** 与 **[安全披露](SECURITY.md)**。
- 使用 **pnpm**（见 `package.json` 的 `packageManager`），Node **≥ 18**。
- 提交 PR 前本地执行 **`pnpm run typecheck`**、**`pnpm run lint`**、**`pnpm run format:check`**；合并需通过 **CI**。
- 提交信息建议清晰可读；若团队采用约定式提交（Conventional Commits）可自行统一，本仓库不强制 hook。
- 本仓库托管在 **GitHub**，Issue 表单与 Actions 在默认配置下即可使用。

---

## Code of conduct

All participants must follow our **[Code of Conduct](CODE_OF_CONDUCT.md)**. Harassment or abuse is not tolerated.

## Security

Do **not** open public issues for security vulnerabilities. Follow **[SECURITY.md](SECURITY.md)**.

## Development setup

```bash
pnpm install
pnpm dev
```

### Useful commands

| Command                                  | Purpose                           |
| ---------------------------------------- | --------------------------------- |
| `pnpm run typecheck`                     | TypeScript (main + renderer)      |
| `pnpm run lint`                          | ESLint                            |
| `pnpm run format`                        | Prettier (write)                  |
| `pnpm run format:check`                  | Prettier (CI, read-only)          |
| `pnpm run build`                         | Production bundle (electron-vite) |
| `pnpm run build:mac` / `:win` / `:linux` | Platform installers (local)       |

### Project layout (high level)

- `src/main` — Electron main process, IPC, services, database
- `src/preload` — context-isolated bridge (`contextBridge`)
- `src/renderer` — React UI

## Pull requests

1. **Open an issue first** for large or ambiguous changes (unless it’s a trivial fix).
2. **One logical change per PR** when possible; avoid unrelated drive-by edits.
3. **Update `CHANGELOG.md`** under `[Unreleased]` when the change is user-visible or affects packagers/developers.
4. Ensure **no secrets** (keys, tokens, personal paths) appear in commits or screenshots.
5. Fill in the **[PR template](.github/pull_request_template.md)**.

### Reviews

Maintainers may request changes or split work. A green **CI** run is required before merge unless explicitly waived (e.g. infra outage).

## Continuous integration

Workflow: **[`.github/workflows/ci.yml`](.github/workflows/ci.yml)**

- **validate** — `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `format:check` (Ubuntu)
- **build** — `pnpm run build` on Ubuntu, macOS, and Windows

CI runs on **GitHub Actions**; after the first push to `main`, the workflow appears under the **Actions** tab.

## Dependency updates

[Dependabot](.github/dependabot.yml) proposes weekly npm and GitHub Actions updates. Maintainers merge after reviewing release notes and CI.

## License

By contributing, you agree that your contributions are licensed under the **same terms as the project** — see **[LICENSE](LICENSE)** (MIT).
