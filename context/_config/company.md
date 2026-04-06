# Agent OS

## What it is

Agent OS is an open-source operating system for AI-first businesses. It structures work and knowledge on disk so any agent can orient quickly: **lists** (what to do), **context** (what to know), and **actions** (how to execute). The filesystem is the source of truth.

## Business model

Fully open source under the MIT license. No paid product planned; a hosted version may exist later so more people can try the app without a local setup—not a current priority.

## Stage

Pre-launch: actively building and dogfooding the product. No broad public launch yet.

## Who it serves

Founders and operators who run businesses where agents are part of day-to-day work and need a legible, file-based way to track intent, knowledge, and repeatable procedures.

## Product surface

- **Convention:** Root `lists/`, `context/`, `actions/` plus per-instance layout defined in [SPEC.md](../../SPEC.md) (`AGENT.md`, `list.yml`, registries, `log/`).
- **Dogfood instance:** `ops/` — the team’s own Agent OS instance for building Agent OS.
- **Scaffold:** `template/` and `create-agent-os` CLI for new instances.
- **App:** `app/server` (Hono + Node) and `app/client` (React + Vite) observe and work with `ops/` by default.
- **MCP:** `mcp-kanban/` — kanban view over root `lists/`.

## Tech stack

- Node.js (ES modules)
- Server: Hono
- Client: React, Vite
- Agent integration: `@anthropic-ai/claude-agent-sdk`

## Differentiator

Plain files and folders—not a proprietary database or UI—as the coordination layer. Humans own priorities; agents load only the context and actions a task references.
