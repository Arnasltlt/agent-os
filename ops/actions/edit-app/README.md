# Edit agent-os App (Main Website)

**Status:** active
**Linked Context:** `app`
**Context setup status:** needs_setup (canonical remote URL not yet recorded)

## What This Action Does

Grants agents write access to the agent-os main website application — the
primary codebase being actively developed. Agents may read, edit, create, and
delete files within the target directory.

## Target

| Field              | Value                                              |
|--------------------|----------------------------------------------------|
| Kind               | repository                                         |
| Location           | `/Users/seima/Documents/cursor/agent-os/app`       |
| Working Directory  | `/Users/seima/Documents/cursor/agent-os/app`       |
| Remote URL         | *(not yet set — see requirements.md)*              |

> **Note:** The location above is a provisional machine-local path. Once the
> canonical git remote URL is added to `context/app/source.yml` and
> `actions/edit-app/action.yml`, agents should pull from remote before editing.

## Instructions for Agents

- Work directly in `/Users/seima/Documents/cursor/agent-os/app`.
- **Do NOT edit** `context/app/repo/` — that is a read-only snapshot.
- Follow project conventions:
  - React 19 + TypeScript frontend lives under `client/`
  - Node.js + Hono backend lives under `server/`
- Run linting and existing tests before committing changes.
- Never store secrets, credentials, or tokens in tracked files.
- When a canonical remote URL is available: `git pull` before starting work;
  open a pull request or push to a feature branch when done.

## Completing Setup

See `context/app/requirements.md` for steps to add the canonical remote URL
and promote this source to `active`.
