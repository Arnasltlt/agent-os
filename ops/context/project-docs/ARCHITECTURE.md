# Architecture

## Overview

agent-os is a file-based convention first and an application second.

The convention defines the durable operating model:

- `list.yml` for work
- `context/` for read-model sources
- `actions/` for write and execution boundaries
- `log/` for output and archives

The app is optional tooling that reads and writes those files locally.

## Three Primitives

### 1. List — `list.yml`

A single YAML file of tasks. Humans own ordering and priority. Agents read it
to find work and should update status explicitly.

Tasks should declare the contract they need to execute:

```yaml
list:
  - id: TASK-001
    title: Example task
    status: ready
    context:
      - company
    actions:
      - edit-website
    depends_on: []
```

`context` references context registry ids. `actions` references action registry
ids. `depends_on` references other task ids.

### 2. Context — `context/`

Everything agents can read to understand the business. Business docs, code
repositories, database descriptions, API notes, and other durable knowledge are
registered in `context/registry.yml`.

Each source should live under `context/<source-id>/` and typically contains:

- `README.md`
- `source.yml`
- optional fetched artifacts or setup docs

Context is descriptive and read-first. It does not grant write permission.

### 3. Actions — `actions/`

What agents may change and where they may change it. `actions/registry.yml`
indexes explicit writable targets, while each `actions/<action-id>/` folder
contains a `README.md` and `action.yml`.

Actions answer:

- can this be changed
- where is the canonical target
- how should an agent work with it

`log/` is output, not a primitive. Completed tasks are archived to
`log/completed.md`.

## Monorepo Layout

```text
agent-os/
├── app/          ← Optional local app for viewing and operating the files
├── ops/          ← Dogfood agent-os instance used to build agent-os itself
├── template/     ← Canonical scaffold for new instances
└── SPEC.md       ← Convention and schema source of truth
```

`ops/` is both the configuration for this project and a live demonstration that
the convention works.

## Current App Execution Flow

The current local app implements one way to operate the convention:

1. User selects a task from `list.yml`
2. Server resolves the task's declared context and actions
3. For legacy tasks without explicit action scope, the server falls back to the
   older “all active actions” behavior
4. Server assembles a system prompt from the task, resolved context, and
   permitted actions
5. Claude Code executes with runtime filesystem permissions scoped to the
   resolved actions
6. The app streams output back over SSE
7. Completed tasks are archived to `log/completed.md`

## Context Onboarding

Adding a new context source is itself an agent-assisted file-writing flow:

1. User describes the source in the app
2. The onboarding agent creates or updates `context/<source-id>/`
3. The onboarding agent updates `context/registry.yml`
4. If the source should be writable, the onboarding agent also creates a linked
   action under `actions/<action-id>/`
5. If setup is incomplete, the source or action is marked `needs_setup`

## Technology Choices

| Component | Choice | Why |
|-----------|--------|-----|
| Convention | Filesystem + YAML/Markdown | Portable, inspectable, versionable |
| Server runtime | Node.js | Easy local tooling |
| Server framework | Hono | Small HTTP surface |
| Frontend | React 19 + Vite | Optional local UI |
| LLM integration | Claude Code SDK | Agent execution with filesystem scope |
| Streaming | SSE | Simple live logs |
