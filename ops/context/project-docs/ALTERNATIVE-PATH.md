# Alternative Path — What to Build First

## The reframe

The current roadmap treats agent-os as a **web app** — Kanban board, UI, drag-and-drop. That's one valid path.

But there's a faster, more valuable path: treat agent-os as a **convention + CLI**, not a UI product. Ship the scaffold first. The app is optional.

The insight: solio-ops already works. It runs a real business. Agents navigate it. It has no app. The value is in the *folder structure and the conventions*, not the visual layer.

---

## The alternative path: Convention-first

### What "v1" actually means on this path

A new developer (or agent) can:
1. Run one command → get a correctly scaffolded ops folder for their business
2. Open any agent (Cursor, Claude Code, OpenClaw) → agent immediately self-orients
3. Add their business data → agents can start executing tasks

That's it. No Kanban required.

---

## Phase 1 — The scaffold spec (this week)

Define the convention precisely enough that anyone can follow it manually, and any agent can navigate it reliably.

**Deliverables:**
- `SPEC.md` — the canonical spec: what files must exist, what's optional, what schema each file follows
- A hardened `AGENT.md` template — the universal entry point every instance must have
- A hardened `list.yml` schema — tasks with explicit `context` and `actions` references (not just a title + status)
- `context/registry.yml` schema — how context sources are declared
- `actions/registry.yml` schema — how writable targets are declared

**The task↔context↔action linkage is the core primitive.** Each task should look like:

```yaml
- id: TASK-001
  title: Write Q2 email campaign
  status: ready
  context:
    - email/templates
    - contacts/segments
  actions:
    - send-email-campaign
  depends_on: []
```

This is the structural insight that separates agent-os from a plain to-do list. The task knows what it needs to run. Agents don't have to guess.

---

## Phase 2 — Solis dogfood (this week / next)

Port solio-ops into agent-os format. This is both a validation test and the first real instance.

**Why Solis specifically:**
- It's a real business with real data (contacts, tasks, engineering backlog, email history)
- It already has a working ops folder that evolved organically
- If agent-os can represent everything solio-ops already does — and do it better — the convention is proven
- OpenClaw (Otron) can use it immediately, making it a live test of whether agents actually self-orient

**What to map:**
- `company/` → context source (read-only, business truth)
- `product/` → context source (read-only, product knowledge)
- `engineering/` → context + actions (read + writable task list)
- `email/` → context + actions (read templates, writable: send log)
- `contacts/` → context source
- `QUEUE.yml` → root `list.yml` (cross-domain work queue)
- Roles → explicit action scopes per role

**Success criteria:** Otron opens the Solis agent-os instance and can:
- Orient without being told anything
- Pick up a task from the queue
- Know exactly what context to read and what it's allowed to change
- Execute and log the result

---

## Phase 3 — CLI scaffolding

Once the convention is proven on a real instance, build the generator.

```bash
npx create-agent-os my-business
```

Walks you through:
1. Business name and description
2. What domains exist (engineering, product, marketing, ops, etc.)
3. Generates the folder structure with correct AGENT.md, list.yml, context/registry.yml, actions/registry.yml

No AI required at this step — just a clean scaffold the human fills in.

**Optionally:** a context onboarding agent that reads your existing docs/repos and populates the context sources automatically.

---

## Phase 4 — The app (if needed)

The Kanban UI becomes optional polish, not the foundation. By this point you know:
- What the data model actually needs to be (from real usage)
- What humans actually want to see (from Solis dogfood)
- What agents actually need (from watching them navigate it)

Build the UI against proven file schemas, not hypothetical ones.

---

## What to deprioritize

- Multi-provider LLM support (Claude Code is fine for now)
- Heartbeat / scheduled runs (OpenClaw already does this — agent-os doesn't need to)
- Role/playbook system (valuable, but after the base convention is solid)
- Integrations (Trello, Linear, etc.) — these are adapters, not core

---

## The positioning shift this path implies

Stop describing agent-os as a "Kanban board + AI runner."

Start describing it as:

> **A file-based convention for making your business legible to AI agents.**
> Any agent. Any tool. Drop it in, and your agents immediately know what to do, what they can read, and what they're allowed to change.

This is closer to what solio-ops actually is — and it's a genuinely empty space in the ecosystem. MCP servers give agents tools. agent-os gives agents *organizational memory and permission boundaries.*

---

## Immediate next action

1. Write `SPEC.md` — the canonical convention document
2. Scaffold a new `solis/` instance inside agent-os following the spec
3. Migrate solio-ops data into it
4. Test: can Otron navigate it cold?

The whole thing can be validated in a week without writing a single line of app code.
