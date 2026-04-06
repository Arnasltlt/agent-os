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
- Business model: fully open source (MIT license); optional hosted version later, not a current priority
- Public repo: https://github.com/Arnasltlt/agent-os (master branch, tracking origin/master)
- Convention influenced by three frameworks: Agent OS primitives, Van Clief's ICM, Karpathy's LLM Knowledge Bases
