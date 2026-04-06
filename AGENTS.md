## Learned User Preferences

- Prefers agents to execute directly rather than asking for permission ("you restart" — just do it)
- Uses plan-driven execution: writes detailed plans in `lists/`, expects agent to follow step by step, marking todos as in_progress/completed
- Wants minimal actions setup — start lean and add as needed rather than scaffolding speculatively
- When committing, stage all relevant project files and push; create `.gitignore` if missing

## Learned Workspace Facts

- Web app: server at `app/server/` (Hono, port 3001), client at `app/client/` (React/Vite, port 5173)
- Server defaults `OPS_DIR` to `<repo>/ops` via path resolution from its entry file
- `app/` is the canonical source code; `ops/context/app/repo/` is a one-way mirror — always edit `app/`, sync to mirror
- `ops/` is the dogfood instance used to build Agent OS itself
- `template/` is the scaffold for new agent-os instances; `instances/solis/` is a stub second instance
- `mcp-kanban/` provides a kanban MCP view over root `lists/`
- Business model: open-core (free base + paid premium features or hosting); stage: pre-launch
- Codex CLI requires the workspace to be a git repo (`git init` needed before `codex exec`)
- No git remote configured yet; open-source vs private decision (TASK-003) is the key blocker for public launch
