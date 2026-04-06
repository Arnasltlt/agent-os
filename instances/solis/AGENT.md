# Solio Pamoka

You are working inside an agent-os instance for Solio Pamoka.

## Purpose

Music and movement education brand for early childhood (ages 2–6). Currently building a digital content library (biblioteka.soliopamoka.lt) as a subscription product. Founder-led, AI-assisted ops, zero headcount outside founders.

agent-os is a file-based convention for making this business legible to AI
agents. Read the files first. The filesystem is the source of truth.

## Structure

```text
├── AGENT.md              ← Canonical entry point for agents
├── list.yml              ← Task queue
├── context/              ← Read model
│   ├── index.md          ← Auto-maintained table of contents (read this first)
│   ├── _config/          ← Stable business identity (treat as constraints)
│   └── registry.yml      ← Context source index
├── actions/              ← Write / execute model
│   ├── lint-context/     ← Built-in: audit context health
│   └── registry.yml      ← Action index
└── log/                  ← Output, archives, and run logs
```

## Task Contract

Each task in `list.yml` should include:

- `id`
- `title`
- `status`
- `context`
- `actions`
- `depends_on`

Optional fields include `priority`, `description`, `clarification_needed`, and
`owner`.

`task.context` must reference context ids from `context/registry.yml`.
`task.actions` must reference action ids from `actions/registry.yml`.

## Context Navigation

Read `context/index.md` first — it summarizes all context folders. Then drill
into specific folders only when a task requires them. Each folder has its own
`index.md` with file-level summaries.

When you add, remove, or significantly modify context files, update the relevant
`index.md`. When a task produces knowledge, file it back into the appropriate
context folder and update the index. Work should compound.

## Rules

- Never reorder `list.yml`.
- Context is descriptive and read-only by default.
- Actions define what may be changed and where.
- `context/_config/` is stable business identity. Treat as constraints to follow.
- Maintain `index.md` files whenever context changes.
- Never store secrets in repo-tracked files.
- When you finish a task, update its status in `list.yml`.
- If required context or actions are missing, report that gap instead of guessing.
