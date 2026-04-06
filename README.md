# Agent OS

An open-source operating system for AI-first businesses.

Work, knowledge, and execution live in **plain files** so any agent can orient fast. Three primitives:

- **Lists** — what to do (`list.yml`, or markdown checklists under `lists/`)
- **Context** — what to know (`context/`, indexed by `context/registry.yml`)
- **Actions** — how and where to execute (`actions/`, indexed by `actions/registry.yml`)

The filesystem is the source of truth. Optional tooling in `app/` and `mcp-kanban/` sits on top.

## Influences

Agent OS is built on ideas from three sources:

**Agent OS primitives** — the original contribution. Three primitives (lists, context, actions) that make an entire business legible to any AI agent. Registry-based discovery, read/write permission separation, and a task queue that handles both ad-hoc work and repeatable pipelines.

**Interpretable Context Methodology (ICM)** — Jake Van Clief's research ([arXiv:2603.16021](https://arxiv.org/abs/2603.16021)) on folder structure as agentic architecture. ICM contributes layered context loading, the factory/product separation (`_config/` for stable identity vs. live working context), pipeline actions with numbered stages and review gates, and the principle that plain text makes systems observable by default.

**LLM Knowledge Bases** — Andrej Karpathy's pattern (April 2026) for using LLMs to build and maintain knowledge bases. Karpathy contributes the auto-maintained `index.md` convention (the scaling mechanism that makes selective loading work), the `lint-context` action (periodic health checks for consistency, gaps, and connections), and the insight that query outputs should flow back into context so work compounds over time.

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
