# TASK-004 — Last Run
Date: 2026-03-26T18:48:35.896Z
Session: 28e90c18-a3fc-41f9-96c0-5771a2551cf1

## Result
Done! Here's what changed:

**TASK-004 — Inline add: no priority required**

- **Removed** the priority `<select>` dropdown from the inline quick-add form in the todo list
- **Removed** the `inlineAddPriority` state variable entirely
- **Updated** `handleInlineAdd` to submit only `title` (the server defaults to `medium` when no priority is provided)
- **Cleaned up** all the `setInlineAddPriority('medium')` reset calls from cancel/blur/escape handlers

Now clicking `+ New task` at the bottom of the list expands a simple single-field form — just type a title and press Enter or click **Add**. No priority selection needed.