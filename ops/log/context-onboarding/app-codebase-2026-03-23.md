# Onboarding Log — app-codebase

**Date:** 2026-03-23
**Source ID:** app-codebase
**Type:** repository
**Status:** active

## Summary

Onboarded the `app/` folder — the core product codebase containing both the React frontend
and the Hono backend — as a `repository` context source.

## What Was Done

1. Created `context/sources/app-codebase/` with:
   - `README.md` — structural and architectural documentation for agent consumption
   - `source.yml` — machine-readable manifest covering paths, tech stack, key files, and notes
2. Registered `app-codebase` entry in `context.yml`

## Structure Documented

```
app/
├── client/          ← React 19 + Vite 8 frontend  (port 5173)
│   └── src/
│       ├── App.tsx       # Full UI — Kanban board, task detail panel, context sidebar, agent log streaming
│       ├── api.ts        # API client with SSE streaming for agent runs
│       ├── types.ts      # Shared TypeScript types
│       └── App.css       # All styles
└── server/          ← Hono + Node.js backend  (port 3001)
    └── src/
        ├── index.ts                    # All API routes: /board, /files, /tasks, /agent/start
        ├── providers/claude-code.ts    # Claude Code SDK wrapper — streams agent messages over SSE
        └── providers/types.ts          # AgentProvider interface
```

## Tech Stack

- **Frontend:** React 19, Vite 8, TypeScript
- **Backend:** Hono, Node.js, TypeScript, `yaml` package
- **Agent integration:** `@anthropic-ai/claude-agent-sdk`, `permissionMode: acceptEdits`
- **Data layer:** YAML, CSV, Markdown on the filesystem — no database

## Notes

- `app/` is adjacent to `ops/` in the monorepo (`../app` relative to ops).
- The preset is `repository`; however this is **not a remote clone** — `app/` is part of the
  same git monorepo. A `checkout/` subdirectory was therefore not created; `local_path: "../app"`
  is recorded in `source.yml` instead.
- The Claude Code sandbox is restricted to `ops/` by default. Agents need explicit permission
  or an expanded working directory to access `app/` files at runtime.
- No secrets or credentials were encountered. No `requirements.md` was needed.
- Structure was documented from `context/project-overview.md` (authoritative reference already
  in the registry) since direct sandbox access to `app/` is not available in the ops context.

## Onboarding Status

Complete — no outstanding requirements.
