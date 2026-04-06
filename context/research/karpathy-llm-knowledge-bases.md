# Karpathy: LLM Knowledge Bases

*Research date: 2026-04-06*
*Source: Andrej Karpathy post (April 2026)*
*Purpose: Extract insights for Agent OS context management*

---

## 1. The Pattern

Karpathy describes using LLMs to build and maintain personal knowledge bases for research topics. The core loop:

1. **Ingest** raw source documents (articles, papers, repos, datasets, images) into a `raw/` directory
2. **Compile** them via LLM into a wiki — a collection of `.md` files in a directory structure
3. **Query** the wiki for complex questions — the LLM researches answers across the compiled knowledge
4. **File outputs back** into the wiki, so explorations and queries "add up" in the knowledge base
5. **Lint** the wiki periodically — find inconsistencies, impute missing data, discover connections

The LLM writes and maintains all wiki data. The human rarely touches it directly.

---

## 2. Key Architectural Decisions

### Raw vs. Compiled Separation

Source material (`raw/`) is kept separate from LLM-synthesized knowledge (the wiki). This means:
- New source material can be dropped in anytime
- The compilation step can be re-run incrementally
- You can trace any wiki article back to its sources

### Auto-Maintained Indexes

At ~100 articles and ~400K words, Karpathy found that the LLM handles navigation without fancy RAG. The key: **auto-maintained index files and brief summaries of all documents**. The LLM reads indexes first, then drills into specific articles as needed.

This is the critical scaling mechanism. Without indexes, the LLM would need to scan everything. With indexes, it reads a summary layer and selectively loads detail.

### Output → Knowledge Feedback Loop

Query results don't disappear into a terminal. They get rendered as markdown files, slide shows, or visualizations — then **filed back into the wiki** to enhance it for further queries. Every question you ask makes the knowledge base better.

### Health Checks / Linting

Periodic LLM passes over the wiki to:
- Find inconsistent data across articles
- Impute missing data (using web search)
- Find interesting connections for new article candidates
- Incrementally clean up and enhance data integrity
- Suggest further questions to investigate

Karpathy calls this one of the most useful patterns.

### Tooling Layer

He vibe-coded a search engine over the wiki, usable both via web UI (for humans) and CLI (as an LLM tool for larger queries). The search tool helps the LLM navigate large knowledge bases more efficiently than raw file traversal.

---

## 3. What Agent OS Can Learn

### Insight 1: Index Files Are the Scaling Mechanism

Agent OS has `registry.yml` as a source list, but not content summaries. Karpathy's insight: **every context folder needs an auto-maintained `index.md`** that summarizes what's in it. The agent updates the index whenever it modifies that folder.

This enables:
- Selective loading (read indexes first, drill into detail only when needed)
- Health checks (audit indexes without reading every file)
- Q&A at scale (agent can answer questions across large context)

**Adopted:** `index.md` convention added to Agent OS.

### Insight 2: Knowledge Linting Is a First-Class Operation

Not just a nice-to-have — a repeatable action that keeps the knowledge base healthy over time. Check for staleness, inconsistencies, gaps, and suggest new topics.

**Adopted:** `lint-context` action added to Agent OS template.

### Insight 3: Outputs Should Flow Back to Context

When a task produces knowledge (research, analysis, reports), that output should be filed back into context to enhance it for future work. This is the "add up" principle — work compounds.

**Adopted:** Convention guidance added to Agent OS.

### Insight 4: The Product Gap He Identifies

> "I think there is room here for an incredible new product instead of a hacky collection of scripts."

He's doing this with scripts + Obsidian + CLI tools stitched together. Agent OS provides the structured primitive layer (lists, context, actions) that makes this pattern repeatable across any business, not just personal research.

---

## 4. Differences From Agent OS

| Karpathy | Agent OS |
|----------|----------|
| Personal research focus | Business-wide scope |
| Passive outputs (slides, charts) | Actions that execute against real systems |
| One-way compile pipeline | Living registry with multiple source types |
| Solo researcher workflow | Multi-agent, multi-stakeholder |
| No permission model | Read (context) / write (actions) separation |
| Obsidian as viewer | Optional web app + filesystem |

---

## 5. Key Quote

> "Raw data from a given number of sources is collected, then compiled by an LLM into a .md wiki, then operated on by various CLIs by the LLM to do Q&A and to incrementally enhance the wiki, and all of it viewable in Obsidian. You rarely ever write or edit the wiki manually, it's the domain of the LLM."

This is the same philosophy as Agent OS: the agent maintains the knowledge, the human owns intent and direction.
