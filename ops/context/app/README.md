# agent-os App — Main Website (Source Code)

**Status: needs_setup** | Type: repository | Default action: `edit-app`

> **needs_setup:** No canonical git remote URL has been recorded yet.
> See `requirements.md` for completion steps. The `edit-app` action is **active**
> and agents may work on the provisional local path in the meantime.

## What It Is

This is the **main website application** being actively built — the agent-os
web UI. It is a file-based business operating system built around the principle
that **the filesystem IS the database**. All state lives in YAML and Markdown
files within an "ops directory." The app provides:

- A **kanban task board** driven by a `list.yml` task queue
- A **context source manager** backed by `context/registry.yml`
- A **file browser** for the ops directory
- **AI agent orchestration** — launches Claude Code agents via SSE streaming
  and scopes filesystem writes to `ops/` plus any explicit active action target

The source snapshot is available locally at `context/app/repo/` (git-ignored)
for read-only context. The canonical writable target is the provisional path
`/Users/seima/Documents/cursor/agent-os/app` via the `edit-app` action.

---

## Project Structure

```
repo/
├── client/          # React 19 + TypeScript + Vite frontend  (port 5173)
│   └── src/
│       ├── App.tsx  # Main UI: Dashboard, List (kanban), Context, Actions,
│       │            #           Files, Setup tabs
│       ├── api.ts   # Typed HTTP + SSE client
│       └── types.ts # Shared TypeScript types
│
└── server/          # Node.js + Hono backend  (port 3001)
    └── src/
        ├── index.ts                  # All REST API routes
        └── providers/
            ├── types.ts              # AgentProvider interface + AgentMessage union
            └── claude-code.ts        # Claude Code SDK provider
```

---

## Technology Stack

| Layer     | Technology                                              |
|-----------|---------------------------------------------------------|
| Frontend  | React 19, TypeScript 5.9, Vite 8                        |
| Backend   | Node.js 22, Hono 4.7, tsx 4.19                          |
| AI        | `@anthropic-ai/claude-agent-sdk` 0.2.81                 |
| Data      | YAML (js-yaml), plain Markdown — no external DB         |
| Streaming | Server-Sent Events (SSE)                                |

---

## Key API Endpoints (server/src/index.ts)

| Method   | Path                     | Purpose                                        |
|----------|--------------------------|------------------------------------------------|
| GET      | `/api/board`             | Load tasks, context sources, project name      |
| POST     | `/api/agent/start`       | Launch Claude Code agent (SSE stream)          |
| GET      | `/api/actions`           | List explicit writable actions                 |
| POST     | `/api/context/start`     | Onboard a new context source (SSE stream)      |
| GET      | `/api/files`             | Recursive ops-directory file tree              |
| PATCH    | `/api/actions/:id`       | Update action target / instructions            |
| PATCH    | `/api/tasks/:id`         | Update task status / archive completed tasks   |
| GET/POST/DELETE | `/api/context/*`  | CRUD on context registry entries               |

---

## Runtime Data Files (ops directory)

| File                          | Purpose                                      |
|-------------------------------|----------------------------------------------|
| `list.yml`                    | Task queue — id, title, status, priority … |
| `context/registry.yml`        | Registry of all context sources              |
| `context/<id>/`               | Per-source folder with README.md & source.yml|
| `log/completed.md`            | Append-only archive of completed tasks       |

The server reads `OPS_DIR` from the environment (defaults to `process.cwd()`).

---

## How to Run

```bash
# Backend (port 3001)
cd /Users/seima/Documents/cursor/agent-os/app/server && npm install && npm run dev

# Frontend (port 5173 — proxies /api → :3001)
cd /Users/seima/Documents/cursor/agent-os/app/client && npm install && npm run dev
```

---

## Design Principles

- **Filesystem-first**: no external database; YAML + Markdown are the source of truth
- **Thin server**: Hono routes are minimal glue between filesystem and frontend
- **Provider pattern**: `AgentProvider` interface allows swapping Claude Code for other agents
- **Explicit write targets**: context is read metadata; actions define canonical writable targets
- **SSE streaming**: real-time agent output without WebSockets

---

## Completing Setup

See `requirements.md` for steps to record the canonical git remote URL and
promote this source to `active`.
