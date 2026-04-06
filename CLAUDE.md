# Agent OS

This project is structured around three primitives: **lists**, **context**, and **actions**. Together they make a business fully legible to you.

Read this file first. Then read the folders. The filesystem is the source of truth.

## Structure

```
├── CLAUDE.md          ← You are here
├── lists/             ← Living task files you maintain
├── context/           ← Business knowledge you maintain
│   └── _config/       ← Stable business identity (rarely changes)
└── actions/           ← Instructions on how to do things
```

## How to Orient

When you enter this project:

1. Read this file. Now you know what this project is and how it's structured.
2. Read the task list in `lists/`. Now you know what needs to happen.
3. For each task, load only the context sources and actions it references. Don't load everything.

This layered approach matters. The less irrelevant context you load, the better you perform. A task that needs brand guidelines doesn't need competitor research. Load what the task asks for, nothing more.

## Lists

`lists/` is where all work is tracked. Everything that needs to happen — whether it's something you execute, a decision the founder needs to make, or a reminder to follow up on something — lives here as a task in a list.

These are living documents. You read them, execute from them, and update them as work progresses. Some tasks are for you. Some are for the human. The list tracks both.

The format is up to your judgment. A simple checklist is fine:

```markdown
# Website Launch

- [x] Buy domain
- [ ] Set up hosting ← agent
- [ ] Decide on color palette ← founder (needs input)
- [ ] Design landing page ← agent
- [ ] Write launch copy ← agent
- [ ] Review and approve ← founder
- [ ] Go live ← agent
```

When the business needs more structure, a list can grow:

```yaml
- id: TASK-001
  title: Design landing page
  status: ready
  context: [brand, competitors]
  actions: [edit-website]
  description: >
    Create a landing page based on the brand guidelines in context/_config/brand/
    and the competitor analysis in context/competitors/. Use the edit-website
    action for deployment instructions.
```

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

```
context/_config/
├── company.md         ← What the business is, who it serves
├── brand.md           ← Voice, tone, visual identity
└── ...                ← Any other stable business facts
```

### Live context (`context/` subfolders)

Business knowledge that evolves. Customers, competitors, projects, market research. Treat these as information to work with.

```
context/
├── _config/           ← Stable (constraints)
├── customers/         ← Customer data, segments, insights
├── competitors/       ← Market landscape, competitor notes
├── website/           ← Current site structure, content
└── ...                ← Any other topic that matters
```

Any readable format works: markdown, YAML, CSV, JSON, images, PDFs. Organize by topic, use whatever structure makes the content clear. Include a README.md in a folder if it helps explain what's there.

### Context indexes (`index.md`)

Every context folder should have an auto-maintained `index.md` that summarizes what's in it. This is the scaling mechanism — agents read indexes first, then drill into specific files only when needed.

```
context/competitors/
├── index.md               ← Auto-maintained summary of this folder
├── competitor-a.md
├── competitor-b.md
└── pricing-landscape.md
```

An index.md should include:
- A brief summary of what this context folder covers
- A list of every file in the folder with a one-line description
- Key facts or themes that span multiple files
- Last-updated date

When you add, remove, or significantly modify a file in a context folder, update that folder's `index.md`. This keeps the knowledge base navigable without loading everything.

At the root level, `context/` itself should have an `index.md` that summarizes all context folders — a table of contents for the entire knowledge base.

### Filing outputs back to context

When a task produces knowledge — research, analysis, a report — file it back into the relevant context folder. This way every question you answer and every exploration you do makes the knowledge base better for future work. Update the folder's `index.md` after filing.

Rules for context:
- Context is your knowledge base. You may read it, update it, and create new context as the business needs evolve.
- Keep context accurate. If something is outdated, update it. If something is missing, flag it or create it.
- Don't invent business facts. If you don't know something, ask the founder rather than guessing.
- Load selectively. A task's `context` field tells you which sources to read.
- Maintain `index.md` files. When you change a context folder, update its index.

## Actions

`actions/` contains instructions for how to do things. Each action is a folder with a README.md that explains what the action does, what it targets, and how to execute it.

### Simple actions

Most actions are a single README with instructions:

```
actions/
├── edit-website/
│   └── README.md
├── send-newsletter/
│   └── README.md
└── update-pricing/
    └── README.md
```

A typical action README:

```markdown
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
```

### Pipeline actions (optional)

When an action is a repeatable multi-step workflow — content production, research reports, onboarding sequences — it can use numbered stage folders:

```
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
```

Each stage's CONTEXT.md is a contract:
- **Inputs**: what files to read (from previous stage output/ or from context/)
- **Process**: what to do
- **Outputs**: what to produce and where to put it

The output/ folder of each stage is a review gate. The human can open, read, edit, and save before the next stage runs. The agent picks up whatever the human left there.

This pattern is optional. Most actions don't need it. Use it when you have a workflow that runs repeatedly with different inputs.

### Built-in actions

Some actions are part of the convention itself:

- **`lint-context`** — A health check action that audits the entire context folder for staleness, inconsistencies, gaps, missing indexes, and interesting connections. Run it periodically to keep the knowledge base healthy. See `actions/lint-context/README.md`.

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
