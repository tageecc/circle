# Security policy

## Supported versions

We provide security updates for the **latest minor release** on the default branch (`main`). Older packaged releases may not receive backports unless explicitly announced.

## Reporting a vulnerability

**Please do not** open a public GitHub issue for security vulnerabilities.

1. **Preferred:** GitHub **Security → Advisories** (private vulnerability reporting), if the repository is public or you have access.
2. **Otherwise:** Email **tageecc@gmail.com** with:
   - Short description and impact
   - Steps to reproduce (proof-of-concept if possible)
   - Affected versions / commit if known

We aim to acknowledge within **5 business days** and coordinate disclosure after a fix is available.

## Scope

In scope:

- This repository’s application code (Electron main, preload, renderer)
- Packaging and update configuration that could lead to RCE or integrity issues

Out of scope (unless they directly affect this app’s shipped code):

- Third-party AI provider APIs and their terms
- User-supplied MCP servers and custom tools (treat as untrusted extensions)

## Secure development notes

- API keys belong in user configuration or `.env` (never committed). See `.gitignore`.
- Review IPC handlers for path traversal and unsafe `shell` usage when changing file or terminal features.
