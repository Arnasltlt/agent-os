# TASK-009 — Last Run
Date: 2026-03-27T03:57:15.739Z
Session: b82b70ca-6954-4326-8d12-58db43bbed89

## Result
Done! Here's what was removed from the To Do column:

- **"+ New task" trigger button** — the inline add button at the bottom of the TO DO column
- **Inline add form** — the input, "Add", and "Cancel" buttons that appeared when clicking it
- **3 state variables** — `inlineAddOpen`, `inlineAddTitle`, `inlineAdding`
- **`handleInlineAdd` handler** — the async function that called `createTask`

The TO DO column now just shows the task cards with no new-task entry UI.