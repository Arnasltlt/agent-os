# Project Documentation (Architecture & Roadmap)

**Source ID:** `project-docs`
**Type:** folder
**Status:** active
**Local path:** `~/Documents/cursor/agent-os/ops/context/project-docs` (relative from ops/: `context/project-docs`)

---

## What This Is

This context source points to the `docs/` folder at the root of the agent-os monorepo. It contains architecture and roadmap documentation — the authoritative written record of how the system is designed and where it is headed.

---

## Contents

| File | Description |
|------|-------------|
| `ARCHITECTURE.md` | System design covering the three primitives (list.yml, context/, actions/), component diagram, execution flow, and technology choices |
| `ROADMAP.md` | Development roadmap in five phases: MVP, Agent Integration, Setup Wizard, Integrations, and Community — each with a task checklist |

---

## How Agents Should Use This

1. **Before proposing structural changes** — read `ARCHITECTURE.md` to understand existing design intent and avoid conflicts.
2. **Before starting a new feature** — check `ROADMAP.md` to confirm the feature is planned and understand its priority.
3. **When resolving ambiguity** — architecture documents take precedence over code comments when they conflict.
4. **When planning implementation order** — roadmap priority ordering should guide which tasks are tackled first.

---

## Files in This Source

| File | Description |
|------|-------------|
| `README.md` | This file — human-readable summary for agents |
| `source.yml` | Machine-readable manifest with actual file inventory |
