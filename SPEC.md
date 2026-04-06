# agent-os Specification

agent-os is a file-based convention for making a business legible to AI agents.
The convention is the product. The web app is optional tooling layered on top.

## Required Instance Layout

Every agent-os instance must contain:

```text
agent-os-instance/
├── AGENT.md
├── list.yml
├── context/
│   └── registry.yml
├── actions/
│   └── registry.yml
└── log/
```

Required paths:

- `AGENT.md`: canonical entry point for any agent entering the instance
- `list.yml`: task queue
- `context/registry.yml`: read-model index
- `actions/registry.yml`: write/execute-model index
- `log/`: run output, archives, and other exhaust

Compatibility files such as `CLAUDE.md` and `AGENTS.md` may exist, but `AGENT.md`
is authoritative.

## Task Schema

`list.yml` contains a top-level `list:` array. Each task must include these
fields:

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

Required task fields:

- `id`: stable task identifier, typically `TASK-NNN`
- `title`: short action-oriented title
- `status`: task state, typically `ready`, `in_progress`, `blocked`, or `done`
- `context`: array of context registry ids required to understand the task
- `actions`: array of action registry ids that define what the agent may change
- `depends_on`: array of task ids that must complete first

Optional task fields:

- `priority`: `critical`, `high`, `medium`, or `low`
- `description`: detailed execution brief or acceptance criteria
- `clarification_needed`: boolean flag for tasks that intentionally ask for human clarification
- `owner`: optional human or role label

Identifier semantics:

- `task.context` references `context/registry.yml` entry ids, not file paths
- `task.actions` references `actions/registry.yml` entry ids, not arbitrary locations
- `task.depends_on` references other task ids in the same `list.yml`

Legacy tasks that omit `context`, `actions`, or `depends_on` may be normalized to
empty arrays by tooling, but new tasks should write them explicitly.

## Context Registry Schema

`context/registry.yml` contains a top-level `context:` array.

```yaml
context:
  - id: company
    name: Company Overview
    type: folder
    path: context/company
    status: active
    editable: false
    description: Business facts and operating context.
```

Expected fields:

- `id`: stable context source id
- `name`: human-readable name
- `type`: one of `website`, `repository`, `folder`, `file`, `database`, `api`, `email`, `mcp`, `custom`
- `path`: relative path to the source folder inside `context/`
- `status`: typically `active`, `needs_setup`, `error`, `inactive`, or `draft`
- `description`: summary of what the source contains

Optional fields commonly used by tooling:

- `editable`: whether there is a linked writable path managed via actions
- `default_action_id`: default action id associated with this context source
- `origin`: canonical remote URL or durable source identity
- `artifacts`, `metadata`, `runtime`, `requirements`, `provider`, `config`

Each context source should have its own folder at `context/<id>/` containing:

- `README.md`: human-readable explanation
- `source.yml`: machine-readable manifest
- `index.md`: auto-maintained summary (see below)
- optional fetched artifacts or setup docs

Context is read-first metadata. It does not grant write permission by itself.

### Context Index Convention

Every context folder should contain an `index.md` file that the agent auto-maintains.
This is the primary mechanism for scaling context beyond what fits in a single
context window.

An `index.md` should contain:

- Brief summary of what the folder covers
- List of every file with a one-line description
- Key facts or themes spanning multiple files
- Last-updated date

The root `context/` directory should also have an `index.md` that serves as a
table of contents across all context folders.

Agents should:
1. Read `index.md` files first when exploring context
2. Drill into specific files only when the index indicates relevance
3. Update `index.md` whenever they add, remove, or significantly modify files
   in that folder

This convention replaces the need for RAG or vector search at small-to-medium
scale (~100 documents, ~400K words). At larger scales, additional search tooling
may be layered on top.

## Action Registry Schema

`actions/registry.yml` contains a top-level `actions:` array.

```yaml
actions:
  - id: edit-website
    name: Edit Website
    status: active
    path: actions/edit-website
    context_id: website
    target:
      kind: repository
      location: /absolute/path/to/repo
      cwd: /absolute/path/to/repo
```

Expected fields:

- `id`: stable action id
- `name`: human-readable name
- `status`: typically `active`, `needs_setup`, `inactive`, or `draft`
- `path`: relative path to the action folder inside `actions/`
- `target.kind`: target type, usually `filesystem` or `repository`
- `target.location`: canonical writable target location

Optional fields commonly used by tooling:

- `context_id`: related context source id
- `auto_created`: whether onboarding created the action automatically
- `instructions`: execution guidance for agents
- `target.cwd`: working directory for commands

Each action should have its own folder at `actions/<id>/` containing:

- `README.md`: human-readable explanation
- `action.yml`: machine-readable manifest

Actions define what agents may change and where they may change it.

## Operating Rules

- The filesystem is the source of truth.
- Humans own priority, ordering, and task intent.
- Agents may update task status and execute work within explicit action boundaries.
- Never infer edit permission from context alone.
- Prefer durable identifiers and canonical remotes over machine-local path identity.

## Context Loading

Agents should load context selectively based on task requirements.

When a task specifies `context: [brand, competitors]`, the agent should:
1. Read `context/registry.yml` to resolve those ids to paths
2. Load only those context sources
3. Skip all other context sources

This prevents context window bloat and improves output quality. A task
that needs brand guidelines does not need customer data.

The entry point file (AGENT.md) plus the task definition plus the relevant
context sources should be the complete context for any task execution.

### Stable Context Convention

Context sources that represent stable business identity — company facts,
brand voice, design guidelines — should be placed in `context/_config/`.

These sources change rarely and should be treated as constraints (rules
to follow) rather than information to process. The `_config/` prefix
signals this distinction to both agents and humans.

Sources in `context/_config/` follow the same registry schema. Their
registry entry should include `stable: true` to mark them as factory
configuration.

### Pipeline Actions

When an action represents a repeatable multi-step workflow, it may use
numbered stage folders inside its action directory:

```text
actions/<action-id>/
├── README.md
├── 01_<stage-name>/
│   ├── CONTEXT.md
│   ├── references/
│   └── output/
├── 02_<stage-name>/
│   ├── CONTEXT.md
│   ├── references/
│   └── output/
└── ...
```

Stage conventions:
- Numbered prefixes (`01_`, `02_`) encode execution order
- Each stage's `CONTEXT.md` specifies inputs, process, and outputs
- `references/` holds stable material for that stage (Layer 3)
- `output/` holds stage results and serves as the handoff point
- Output of stage N is available as input to stage N+1
- Humans may review and edit `output/` contents between stages

This pattern is optional. Simple actions remain a single README.md.
