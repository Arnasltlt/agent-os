# Agent OS

An open-source operating system for AI-first businesses.

Work, knowledge, and execution live in **plain files** so any agent can orient fast. Three primitives:

- **Lists** — what to do (`list.yml`, or markdown checklists under `lists/`)
- **Context** — what to know (`context/`, indexed by `context/registry.yml`)
- **Actions** — how and where to execute (`actions/`, indexed by `actions/registry.yml`)

The filesystem is the source of truth. Optional tooling in `app/` and `mcp-kanban/` sits on top.

## Quick start

```bash
npx create-agent-os my-business
cd my-business
```

From a clone of this repo before publish, run `node scripts/create-agent-os.js` instead (same scaffold).

Read [CLAUDE.md](CLAUDE.md) for how agents should work in this repo. The full instance schema is in [SPEC.md](SPEC.md).

## Repo layout

| Path | Purpose |
|------|---------|
| `SPEC.md` | Convention and YAML schemas |
| `template/` | Files copied by `create-agent-os` |
| `ops/` | Dogfood instance for building Agent OS |
| `app/` | Local UI + server (Hono, React, Vite) |
| `mcp-kanban/` | MCP server + kanban UI over `lists/` |

## Develop the app

```bash
npm run install:all
npm run dev
```

## License

MIT
