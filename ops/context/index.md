# Context Index (ops)

*Last updated: 2026-04-06*

Overview of all project knowledge for the Agent OS dogfood instance.

## Folders

| Folder | Source ID | Description |
|--------|-----------|-------------|
| `app/` | `app` | React 19 + Node.js Hono application source code. Primary codebase agents read and modify. |
| `project-docs/` | `project-docs` | Architecture and roadmap documentation. Read before proposing structural changes. |

## Key facts

- The app source lives at `/app` in the repo root; `context/app/` mirrors it one-way for reading
- `app` context is editable via the `edit-app` action (targets the real `/app` directory)
- `project-docs` is read-only reference material
