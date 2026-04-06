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
│   └── registry.yml      ← Context source index
├── actions/              ← Write / execute model
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

## Rules

- Never reorder `list.yml`.
- Context is descriptive and read-only by default.
- Actions define what may be changed and where.
- Never store secrets in repo-tracked files.
- When you finish a task, update its status in `list.yml`.
- If required context or actions are missing, report that gap instead of guessing.
