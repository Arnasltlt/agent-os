# agent-os Project Roadmap

## Phase 1 — MVP (Core Loop)

The minimum to be useful: a Kanban board over files.

- [x] Server: File read/write API (YAML, CSV, Markdown parsing)
- [x] Server: list.yml → card list endpoint
- [x] Server: Card status update → write back to source file
- [x] Server: Task creation (auto-incrementing IDs)
- [x] Server: Task archival to log/completed.md on completion
- [x] Frontend: Kanban board with drag-and-drop
- [x] Frontend: Card detail view (shows task context, related files)
- [x] Frontend: Sidebar file tree with click-to-view
- [x] Frontend: Markdown/YAML file viewer in the browser
- [ ] Frontend: In-browser file editing (view works; write-back not yet wired)
- [ ] Git: Auto-commit on every file change
- [ ] CLI: `npx create-agent-os` scaffolding command

## Phase 2 — Agent Integration

Make agents actually run from the UI.

- [x] LLM config: API key setup (Anthropic / Claude Code SDK)
- [x] Agent runner: Assemble context + task → LLM call
- [x] Agent runner: Apply LLM file changes back to disk
- [x] Agent runner: SSE streaming of live agent output to the browser
- [x] Agent runner: Conversation history + session resume
- [x] UI: "Run agent" button on task cards
- [x] UI: Live agent activity log (streamed tool use + output)
- [x] Context system: registry.yml as source index
- [x] Context system: Per-source README.md + source.yml metadata
- [x] Context system: Context browser UI (view, add, preview sources)
- [x] Context system: Context onboarding agent (separate SSE flow)
- [x] Action system: actions/registry.yml + per-action README/action.yml for writable targets
- [x] Action system: Editable context auto-creates a linked default action
- [x] Action system: Task runtime exposes all active actions as writable targets
- [ ] TCA framework: roles.yml + role-scoped context + role-scoped actions + playbooks (TASK-002)
- [ ] Heartbeat: Scheduled agent runs (configurable interval)
- [ ] UI: Pending changes review before auto-commit

## Phase 3 — Setup Wizard

Make onboarding frictionless.

- [ ] Wizard: "Describe your business" → agent populates template files
- [ ] Wizard: Suggest domain folders based on business type
- [ ] Wizard: Suggest initial roles based on team description
- [ ] CLI: `npx create-agent-os` scaffolding (TASK-003)
- [ ] Templates: Pre-built ops structures for common business types
  - [ ] SaaS
  - [ ] E-commerce
  - [ ] Agency/consultancy
  - [ ] Content/media

## Phase 4 — Integrations

Bridge to existing tools.

- [ ] Adapter pattern: bidirectional sync interface
- [ ] Trello adapter
- [ ] Linear adapter
- [ ] Slack adapter (post summaries to channels)
- [ ] Google Sheets adapter (sync TASKS.csv)
- [ ] Webhook support (trigger external actions on card changes)

## Phase 5 — Community

- [ ] Plugin system for custom playbooks
- [ ] Template marketplace (share ops structures)
- [ ] Documentation site
- [ ] Example walkthroughs (video/written)
