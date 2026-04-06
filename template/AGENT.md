# {{BUSINESS_NAME}}

You are working inside an agent-os instance for {{BUSINESS_NAME}}.

{{BUSINESS_DESCRIPTION}}

## Structure

```text
├── AGENT.md              ← You are here
├── list.yml              ← Task queue (what needs to happen)
├── context/              ← Business knowledge (what you need to know)
│   ├── index.md          ← Auto-maintained table of contents (read this first)
│   ├── _config/          ← Stable business identity (treat as constraints)
│   └── registry.yml      ← Index of all context sources
├── actions/              ← Execution instructions (what you may change)
│   ├── lint-context/     ← Built-in: audit context health
│   └── registry.yml      ← Index of all actions
└── log/                  ← Output and archives
```

## How to Work

1. Read this file. Now you know where you are.
2. Read `list.yml`. Now you know what needs to happen.
3. For each task, load only the context and actions it references. Skip everything else.

## Task Contract

Each task in `list.yml` includes:

- `context`: array of context registry ids → tells you what to read
- `actions`: array of action registry ids → tells you what you may change
- `depends_on`: array of task ids that must complete first

Load the context sources listed. Follow the action instructions referenced. Nothing more.

## Context Navigation

Read `context/index.md` first — it summarizes all context folders. Then drill into specific folders only when a task requires them. Each folder has its own `index.md` with file-level summaries.

When you add, remove, or significantly modify context files, update the relevant `index.md`.

When a task produces knowledge (research, analysis), file it back into the appropriate context folder and update the index. Work should compound.

## Rules

- The filesystem is the source of truth.
- Humans own priorities. Never reorder `list.yml`.
- Context is read-only by default. Actions define what may be changed.
- `context/_config/` is stable business identity. Treat as constraints to follow.
- Maintain `index.md` files whenever context changes.
- Never store secrets in any file.
- When you finish a task, update its status immediately.
- If something is unclear or missing, report that instead of guessing.
