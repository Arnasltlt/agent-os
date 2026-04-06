# Plan: Integrate ICM Insights into Agent OS

Status: **ready for execution**
Executor: Sonnet (or any agent)
Scope: Convention files only. No app/frontend changes.

---

## Context

We researched Jake Van Clief's Interpretable Context Methodology (ICM). Three ideas from ICM strengthen Agent OS without changing what Agent OS is. This plan integrates those ideas.

Read `context/research/jake-van-clief-icm.md` and `context/research/agent-os-vs-icm.html` for the full research if you need background.

## Guiding Principle

Agent OS models a whole business (lists, context, actions). ICM models one workflow pipeline (numbered stages). We are NOT turning Agent OS into ICM. We are borrowing three specific ideas that make Agent OS's existing structure work better:

1. **Layered entry point** — Split the monolithic AGENT.md into a lean identity layer + a routing layer
2. **Factory/product separation** — Distinguish stable context from working material in context/
3. **Pipeline actions** — Add an optional pattern for multi-step workflows inside actions/

Everything else stays the same. Three primitives (lists, context, actions). Filesystem is truth. Humans own intent.

---

## Step 1: Rewrite CLAUDE.md (the project-level convention doc)

**File:** `/CLAUDE.md`
**Action:** Rewrite in place

This is the convention documentation that explains Agent OS to anyone reading the repo. It needs to incorporate the three new ideas while keeping the same spirit. Keep it practical and concise — this file is the pitch for the whole system.

**Changes:**
- Add a "Context Loading" section explaining that agents should load selectively, not dump everything
- Add the factory/product distinction to the Context section: `context/_config/` for stable business facts, regular `context/` folders for live sources
- Add a "Pipeline Actions" subsection to the Actions section showing the optional numbered-stages pattern
- Keep the overall structure: intro → lists → context → actions → onboarding → rules
- Keep the same tone — direct, practical, no academic language
- Remove the duplicate "General Rules" section (currently appears twice)
- Keep total length similar (~150 lines). Don't bloat it.

**New CLAUDE.md content:**

```markdown
# Agent OS

This project is structured around three primitives: **lists**, **context**, and **actions**. Together they make a business fully legible to you.

Read this file first. Then read the folders. The filesystem is the source of truth.

## Structure

├── CLAUDE.md          ← You are here
├── lists/             ← Living task files you maintain
├── context/           ← Business knowledge you maintain
│   └── _config/       ← Stable business identity (rarely changes)
└── actions/           ← Instructions on how to do things

## How to Orient

When you enter this project:

1. Read this file (~800 tokens). Now you know what this project is and how it's structured.
2. Read the task list in `lists/`. Now you know what needs to happen.
3. For each task, load only the context sources and actions it references. Don't load everything.

This layered approach matters. The less irrelevant context you load, the better you perform. A task that needs brand guidelines doesn't need competitor research. Load what the task asks for, nothing more.

## Lists

`lists/` is where all work is tracked. Everything that needs to happen — whether it's something you execute, a decision the founder needs to make, or a reminder to follow up on something — lives here as a task in a list.

These are living documents. You read them, execute from them, and update them as work progresses. Some tasks are for you. Some are for the human. The list tracks both.

The format is up to your judgment. A simple checklist is fine:

# Website Launch

- [x] Buy domain
- [ ] Set up hosting ← agent
- [ ] Decide on color palette ← founder (needs input)
- [ ] Design landing page ← agent
- [ ] Write launch copy ← agent
- [ ] Review and approve ← founder
- [ ] Go live ← agent

When the business needs more structure, a list can grow:

- id: TASK-001
  title: Design landing page
  status: ready
  context: [brand, competitors]
  actions: [edit-website]
  description: >
    Create a landing page based on the brand guidelines in context/_config/brand/
    and the competitor analysis in context/competitors/. Use the edit-website
    action for deployment instructions.

The `context` and `actions` fields on a task tell you what to load. Treat them as your loading instructions — read those sources, skip the rest.

Rules for lists:
- Everything that needs to happen is a task in a list. No work lives outside lists.
- You may update status and add new tasks.
- When you complete a task, mark it done immediately.
- When a task needs human input (a decision, approval, feedback), mark it clearly and notify the founder.
- If something is unclear or blocked, say so instead of guessing.
- Old completed tasks should be archived or deleted to keep the list clean.

## Context

`context/` is everything you need to know about this business. It is your knowledge base.

Context is split into two kinds:

### Stable context (`context/_config/`)

Business identity that rarely changes. The "factory settings" — who the business is, how it sounds, what it looks like. Treat these as constraints to follow.

context/_config/
├── company.md         ← What the business is, who it serves
├── brand.md           ← Voice, tone, visual identity
└── ...                ← Any other stable business facts

### Live context (`context/` subfolders)

Business knowledge that evolves. Customers, competitors, projects, market research. Treat these as information to work with.

context/
├── _config/           ← Stable (constraints)
├── customers/         ← Customer data, segments, insights
├── competitors/       ← Market landscape, competitor notes
├── website/           ← Current site structure, content
└── ...                ← Any other topic that matters

Any readable format works: markdown, YAML, CSV, JSON, images, PDFs. Organize by topic, use whatever structure makes the content clear. Include a README.md in a folder if it helps explain what's there.

Rules for context:
- Context is your knowledge base. You may read it, update it, and create new context as the business needs evolve.
- Keep context accurate. If something is outdated, update it. If something is missing, flag it or create it.
- Don't invent business facts. If you don't know something, ask the founder rather than guessing.
- Load selectively. A task's `context` field tells you which sources to read.

## Actions

`actions/` contains instructions for how to do things. Each action is a folder with a README.md that explains what the action does, what it targets, and how to execute it.

### Simple actions

Most actions are a single README with instructions:

actions/
├── edit-website/
│   └── README.md
├── send-newsletter/
│   └── README.md
└── update-pricing/
    └── README.md

A typical action README:

# Edit Website

## What this does
Edit the company website.

## Target
Repository: https://github.com/acme/website

## How to execute
1. Pull the latest from main
2. Make changes in a feature branch
3. Follow the style conventions in context/_config/brand.md
4. Open a pull request — never push directly to main

## Related context
- context/_config/brand.md — voice and visual guidelines
- context/website/ — current site structure

### Pipeline actions (optional)

When an action is a repeatable multi-step workflow — content production, research reports, onboarding sequences — it can use numbered stage folders:

actions/produce-video/
├── README.md              ← Overview of the whole pipeline
├── 01_research/
│   ├── CONTEXT.md         ← What this stage does, what it reads, what it outputs
│   ├── references/        ← Stable rules for this stage
│   └── output/            ← Stage output (human reviews before next stage)
├── 02_script/
│   ├── CONTEXT.md
│   ├── references/
│   └── output/
└── 03_production/
    ├── CONTEXT.md
    ├── references/
    └── output/

Each stage's CONTEXT.md is a contract:
- **Inputs**: what files to read (from previous stage output/ or from context/)
- **Process**: what to do
- **Outputs**: what to produce and where to put it

The output/ folder of each stage is a review gate. The human can open, read, edit, and save before the next stage runs. The agent picks up whatever the human left there.

This pattern is optional. Most actions don't need it. Use it when you have a workflow that runs repeatedly with different inputs.

Rules for actions:
- Actions are instructions, not permissions. They tell you how to do something well.
- Each action should be self-contained: if you read the README, you know what to do.
- If an action's instructions are unclear or incomplete, ask rather than guess.

## Onboarding

If this project is not yet structured with lists, context, and actions — or if the folders are empty — run the **onboarding skill** (`/onboarding`). It will:

1. Scan what already exists and identify content that belongs in lists, context, or actions
2. Ask the founder targeted questions to fill gaps
3. Structure everything into the three folders

The goal is to get to a state where you can read this project and immediately start working.

## Rules

- The filesystem is the source of truth. Not a database, not an API, not a UI.
- Humans own intent. You execute, but humans decide what matters and in what order.
- Everything goes in the three folders. Work → lists. Knowledge → context. Instructions → actions.
- Load context selectively. A task tells you what to read. Don't load everything.
- Stable business facts go in context/_config/. Everything else goes in topic folders.
- When you generate something the business needs (a tracker, a report template), build it here using files. Start simple.
- Never store secrets or credentials in any file.
- If you are unsure about anything, ask. Reporting a gap is better than guessing wrong.
```

---

## Step 2: Update SPEC.md

**File:** `/SPEC.md`
**Action:** Add three sections to the existing spec

Keep all existing schema definitions. Add these three things:

### 2a: Add context loading guidance after the "Operating Rules" section

Add a new section `## Context Loading` at the end of SPEC.md:

```markdown
## Context Loading

Agents should load context selectively based on task requirements.

When a task specifies `context: [brand, competitors]`, the agent should:
1. Read `context/registry.yml` to resolve those ids to paths
2. Load only those context sources
3. Skip all other context sources

This prevents context window bloat and improves output quality. A task
that needs brand guidelines does not need customer data.

The entry point file (AGENT.md, ~800 tokens) plus the task definition
plus the relevant context sources should be the complete context for
any task execution.
```

### 2b: Add the _config convention to the Context Registry Schema section

Insert after the existing context registry documentation:

```markdown
### Stable Context Convention

Context sources that represent stable business identity — company facts,
brand voice, design guidelines — should be placed in `context/_config/`.

These sources change rarely and should be treated as constraints (rules
to follow) rather than information to process. The `_config/` prefix
signals this distinction to both agents and humans.

Sources in `context/_config/` follow the same registry schema. Their
registry entry should include `stable: true` to mark them as factory
configuration.
```

### 2c: Add the pipeline action pattern to the Action Registry Schema section

Insert after the existing action documentation:

```markdown
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
```

---

## Step 3: Update the instance template

**File:** `/template/AGENT.md`
**Action:** Rewrite to be leaner (~800 tokens) and include routing guidance

```markdown
# {{BUSINESS_NAME}}

You are working inside an agent-os instance for {{BUSINESS_NAME}}.

{{BUSINESS_DESCRIPTION}}

## Structure

├── AGENT.md              ← You are here
├── list.yml              ← Task queue (what needs to happen)
├── context/              ← Business knowledge (what you need to know)
│   ├── _config/          ← Stable business identity (treat as constraints)
│   └── registry.yml      ← Index of all context sources
├── actions/              ← Execution instructions (what you may change)
│   └── registry.yml      ← Index of all actions
└── log/                  ← Output and archives

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

## Rules

- The filesystem is the source of truth.
- Humans own priorities. Never reorder `list.yml`.
- Context is read-only by default. Actions define what may be changed.
- `context/_config/` is stable business identity. Treat as constraints to follow.
- Never store secrets in any file.
- When you finish a task, update its status immediately.
- If something is unclear or missing, report that instead of guessing.
```

---

## Step 4: Create `context/_config/` in the template

**New folder:** `/template/context/_config/`
**New file:** `/template/context/_config/README.md`

```markdown
# Business Configuration

This folder holds stable business identity — facts, brand voice, guidelines,
and conventions that rarely change.

Agents should treat files in `_config/` as constraints to internalize, not
information to process. When your task says to follow the brand voice, read
`_config/brand.md`. When it says to understand the customer, read
`context/customers/`.

Files here are configured once during onboarding or setup. They persist
across all tasks and workflows.
```

---

## Step 5: Create one example pipeline action in the template

**New folder:** `/template/actions/example-pipeline/`
**New file:** `/template/actions/example-pipeline/README.md`

```markdown
# Example Pipeline Action

This is an example of a pipeline action — a repeatable multi-step workflow
using numbered stage folders. Delete this folder and replace with your own
pipeline actions, or ignore it if your actions are all single-step.

## Stages

1. `01_research/` — Gather and structure input material
2. `02_draft/` — Produce the first draft based on research output
3. `03_review/` — Final quality check and formatting

## How it works

Run each stage in order. Between stages, review the output/ folder.
Edit anything that needs adjustment. The next stage reads whatever you
left there.
```

**New file:** `/template/actions/example-pipeline/01_research/CONTEXT.md`

```markdown
## Inputs
- Task brief from the human (provided at runtime)
- context/_config/ for business constraints

## Process
Research the topic. Structure findings into a clear document with key points,
supporting evidence, and recommended angles.

## Outputs
- research.md → output/
```

Create empty `output/` directories in each stage folder (with a `.gitkeep`).

Create minimal `02_draft/CONTEXT.md` and `03_review/CONTEXT.md` following the same Inputs/Process/Outputs pattern.

---

## Step 6: Update the onboarding skill

**File:** `/../../.claude/skills/onboarding/SKILL.md`
**Action:** Add to Phase 3 (Build)

Add these instructions to the existing Phase 3 section:

Under the `#### context/` subsection, add:
```
Place stable business identity files in `context/_config/`. This includes
company overview, brand voice, and any guidelines that won't change between
tasks. Create at minimum `context/_config/company.md`.

Other context folders (customers/, competitors/, website/) go directly under
context/ as before.
```

Under the `#### actions/` subsection, add:
```
If the founder described any repeatable multi-step workflows (e.g., weekly
content production, client reporting, research pipelines), consider creating
these as pipeline actions with numbered stage folders. Only do this if the
workflow clearly has distinct stages with different inputs and outputs.
Most actions should remain simple single-README folders.
```

---

## Step 7: Update the ops instance (dogfood)

**File:** `/ops/AGENT.md`
**Action:** Update to match the new template style

Make it leaner. Add the "How to Work" routing instructions. Add the `_config/` reference. Keep the protected features section.

---

## Step 8: Update Solis instance

**File:** `/instances/solis/AGENT.md`
**Action:** Update to match the new template style

Keep the Solio Pamoka business description. Apply the new structure and routing guidance.

---

## Verification

After all steps are complete:

1. Read the new `/CLAUDE.md` top to bottom. Confirm it's coherent, ~150 lines, covers all three new ideas without losing the original Agent OS spirit.
2. Read `/SPEC.md`. Confirm the three new sections are consistent with existing schema definitions.
3. Read `/template/AGENT.md`. Confirm it's under 50 lines and gives clear routing instructions.
4. Check that `/template/context/_config/README.md` exists.
5. Check that `/template/actions/example-pipeline/` has README.md plus three stage folders with CONTEXT.md files.
6. Read the updated onboarding skill. Confirm _config/ and pipeline guidance was added without breaking existing flow.
7. Confirm no files were deleted that shouldn't have been. This plan only adds and updates — it never removes existing functionality.

---

## What This Plan Does NOT Touch

- The app/ directory (frontend/backend) — no changes
- The mcp-kanban/ directory — no changes
- The package.json — no changes
- The existing list.yml schema — no changes
- The existing registry.yml schemas — only additive (optional `stable: true` field)
- The existing ops/list.yml tasks — no changes
- The existing Solis instance data — only AGENT.md updated
