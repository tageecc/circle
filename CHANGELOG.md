# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Open-source governance: `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`
- GitHub Actions CI (typecheck, lint, Prettier, multi-OS build), Stale bot, Dependabot
- Issue forms (bug, feature, docs), PR template, optional `CODEOWNERS`
- `pnpm run format:check` script

### Changed

- `electron-builder.yml`: stable `appId`; auto-update publish config removed until a release CDN is configured
- CI: `pnpm/action-setup@v4` 不再写死 `version`，与 `package.json` 的 `packageManager` 对齐
- README：重写为与当前 IDE 一致的能力清单；移除对外产品对标表述
- 种子数据默认 Agent 名称由「Cursor Agent」改为「Circle Coding」
