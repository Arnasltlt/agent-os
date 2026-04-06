# agent-os (ops)

You are working inside the ops directory of agent-os, the dogfood instance used
to build and maintain agent-os itself.

## Structure

```text
├── AGENT.md              ← Canonical entry point for agents
├── list.yml              ← Task queue
├── context/              ← Read model
│   ├── index.md          ← Auto-maintained table of contents (read this first)
│   └── registry.yml      ← Context source index
├── actions/              ← Write / execute model
│   ├── lint-context/     ← Built-in: audit context health
│   └── registry.yml      ← Action index
└── log/                  ← Output, archives, and run logs
```

These folders are project-specific. The convention is the product; the app is
optional tooling on top.

## How to Work

1. Read this file. Now you know where you are.
2. Read `context/index.md`. Now you have a map of all project knowledge.
3. Read `list.yml`. Now you know what needs to happen.
4. For each task, load only the context and actions it references. Skip everything else.

## The List

`list.yml` is the single source of queued work. Humans own task ordering and
priority. Agents may update task status but never reorder tasks.

Tasks should include explicit `context`, `actions`, and `depends_on` arrays so
agents know what to read and what they may change.

## Context

Everything in `context/` is read-first information about this project.
Documents, repositories, database connections, API descriptions, and other
business or engineering knowledge belong here.

Each context source is indexed in `context/registry.yml` and should live in its
own folder under `context/<source-id>/`.

## Context Navigation

Read `context/index.md` first — it summarizes all context folders. Then drill
into specific folders only when a task requires them. Each folder has its own
`index.md` with file-level summaries.

When you add, remove, or significantly modify context files, update the relevant
`index.md`. When a task produces knowledge (research, analysis), file it back
into the appropriate context folder and update the index. Work should compound.

## Actions

`actions/` defines explicit writable targets and execution instructions.
Actions answer what may be changed, where the canonical target lives, and how
agents should work with it.

Context never grants write permission by itself.

## Rules

- Never reorder `list.yml`. Only humans set priorities.
- Treat `task.context` as context registry ids, not file paths.
- Treat `task.actions` as action registry ids, not arbitrary writable paths.
- Agents may always modify files inside this ops directory.
- Agents may modify anything outside this ops directory only when an active action explicitly points to that target.
- If an action points to the real source, treat that target as canonical.
- Maintain `index.md` files whenever context changes.
- Never store secrets in any file.
- Log meaningful work in `log/`.
- When you complete a task, set its status to `done` in `list.yml` yourself.
- If something is unclear or blocked, report it instead of guessing.

## Protected Features

These features have been intentionally built and must not be removed unless a
task explicitly names them by their exact description below:

- **Inline scheduler bar** (`list-scheduler-bar`) — the AI task scheduler input at the top of the List view.
- **Session persistence** — `GET /api/tasks/:id/run` and the `taskRunRegistry`.
- **Turn limit detection** — `hitTurnLimit` handling and the Resume button in the task detail panel.
- **Delete task** — `DELETE /api/tasks/:id` and the delete button in the task detail panel.
