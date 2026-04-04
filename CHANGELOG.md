# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.7] - 2026-04-03

### Added

- Plan mode with user approval; subagent delegation, task registry, and related chat UI
- Ignore Apple signing material in `.gitignore` (`*.p12`, `/*.cer`)

### Removed

- `claude-code-best` git submodule reference; obsolete docs under `docs/`

### Changed

- Native agent loops, tools, IPC, and settings/models UI updates for delegation and planning

## [1.0.6]

### Added

- Open-source governance: `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`
- GitHub Actions CI (typecheck, lint, Prettier, multi-OS build), Stale bot, Dependabot
- Issue forms (bug, feature, docs), PR template, optional `CODEOWNERS`
- `pnpm run format:check` script

### Changed

- 运行时不再通过 `dotenv` 加载 `.env`（配置以应用内设置为准）；已移除 `db:seed` / `db:clear` / `db:reset` 等本地数据库种子 CLI
- 移除 `.env.example`；文档与 `CONTRIBUTING` 不再引导复制 env 文件
- `electron-builder.yml`: stable `appId`; auto-update publish config removed until a release CDN is configured
- CI: `pnpm/action-setup@v4` 不再写死 `version`，与 `package.json` 的 `packageManager` 对齐
- README：重写为与当前 IDE 一致的能力清单；移除对外产品对标表述
- 首次启动时创建的默认助手显示名为「Circle Coding」
