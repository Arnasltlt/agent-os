# agent-os

An open-source operating system for AI-first businesses.

**A file-based convention for making your business legible to AI agents.**

## What is this?

agent-os is a file-first convention that gives AI agents structure, memory, and
permission boundaries. The core product is the filesystem layout and schema:
tasks, context, actions, and logs. The local app is optional tooling layered on
top of that convention.

## Core Philosophy

1. **Files are the source of truth.** Everything lives in plain text: YAML,
   Markdown, CSV, and code.
2. **The convention comes first.** Agents should be able to self-orient from the
   files alone. A UI can help, but it is not the foundation.
3. **Agents are bounded, not autonomous.** Context explains what exists. Actions
   define what may be changed and where.
4. **Humans own intent.** Humans set priorities and decide what work matters.

## Canonical Files

Every instance is built around:

```text
├── AGENT.md
├── list.yml
├── context/registry.yml
├── actions/registry.yml
└── log/
```

- **List**: tasks to execute
- **Context**: read-model sources agents use to understand the business
- **Actions**: explicit writable targets and execution instructions
- **Log**: output and archives

See [SPEC.md](/Users/seima/Documents/cursor/agent-os/SPEC.md) for the exact
schema.

## Quick Start

```bash
npx create-agent-os my-business
cd my-business
npx agent-os
```

This will:

1. Scaffold the canonical agent-os files for a new business
2. Let agents orient immediately from `AGENT.md`, `list.yml`, `context/`, and `actions/`
3. Optionally launch the local app for file browsing, task running, and context management

## Project Status

Early stage. The convention is being hardened first. The app remains in the
repo as optional tooling, not the foundation.

## Inspirations

- **OpenClaw**: file-based, human-readable agent architecture
- **solio-ops**: the production operating system this is being extracted from
- **Replit Agent**: showed that thin interfaces can sit on top of agent work

## License

MIT
