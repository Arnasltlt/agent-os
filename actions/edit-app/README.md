# Edit App

## What this does

Change the Agent OS web application: API/server behavior and the browser UI.

## Target

- **Server:** `app/server/` — Hono + Node (`src/index.ts` and related modules)
- **Client:** `app/client/` — React + Vite

The server reads the dogfood instance at `ops/` when `OPS_DIR` points there (default in root dev script).

## How to execute

1. From the repo root, install dependencies if needed:
   - `npm run install:all` — installs `app/server` and `app/client` deps
2. Run locally:
   - `npm run dev:server` — from root; sets `OPS_DIR=../../ops` and runs the server in `app/server`
   - `npm run dev:client` — runs Vite for `app/client` (in another terminal, or use `npm run dev` for both)
3. Make changes under `app/server/` and/or `app/client/`.
4. Use each package’s scripts for checks: e.g. `npm run build` inside `app/server` or `app/client` after substantive edits.

## Related context

- `context/_config/company.md` — what Agent OS is and how the repo fits together
- `ops/context/app/` — architecture and product docs for the app as dogfooded in `ops/`
