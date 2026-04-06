# Lint Context

## What this does

Audit the entire `context/` folder for health issues and incrementally improve data quality.

## When to run

Periodically — after a batch of new context has been added, or when the knowledge base feels stale. Can also be triggered by a task in `list.yml`.

## How to execute

### 1. Index check

For every folder in `context/`, verify:
- [ ] An `index.md` exists
- [ ] The index lists every file in the folder
- [ ] The index summaries are accurate and up to date
- [ ] The last-updated date is recent

Create or update any missing or stale indexes.

### 2. Staleness check

For every context source:
- [ ] Is the information still current? Flag anything that references dates, prices, versions, or facts that may have changed.
- [ ] Are there files that haven't been updated in a long time relative to how fast the topic moves?
- [ ] Are there sources marked `active` in `registry.yml` that are actually empty or placeholder?

### 3. Consistency check

Across all context sources:
- [ ] Do any two files contradict each other? (e.g., different prices, conflicting descriptions, outdated vs. current facts)
- [ ] Are naming conventions consistent? (file names, heading styles, date formats)
- [ ] Do cross-references between files still resolve? (links to other context files that may have moved or been deleted)

### 4. Gap analysis

Look at the context as a whole:
- [ ] Are there obvious topics missing that the business should have documented?
- [ ] Are there questions the task list references that no context source can answer?
- [ ] Can any existing knowledge be connected in ways that aren't currently linked?

### 5. Enrichment suggestions

Based on the audit:
- [ ] Suggest new articles or context files that would strengthen the knowledge base
- [ ] Suggest data that could be imputed or filled in with web research
- [ ] Suggest connections between topics that deserve their own synthesis document

## Output

Produce a report as a markdown file summarizing:
- Issues found (with severity: critical, warning, suggestion)
- Actions taken (indexes created/updated, inconsistencies fixed)
- Recommendations for the founder (new context to add, decisions needed)

File the report into `log/` and update the root `context/index.md` if changes were made.

## Related context

- `context/` — the entire knowledge base (this action audits all of it)
- `context/registry.yml` — source index to cross-reference
