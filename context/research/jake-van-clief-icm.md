# Deep Research: Jake Van Clief & Interpretable Context Methodology (ICM)

*Research date: 2026-04-05*
*Purpose: Extract insights from Van Clief's work to strengthen Agent OS*

---

## 1. Who Is Jake Van Clief?

Jake Van Clief is the founder of Eduba (an AI group chat platform), a University of Edinburgh researcher, Flagler College alumnus, and U.S. Marine Corps veteran (8 years). He is the primary author of "Interpretable Context Methodology: Folder Structure as Agentic Architecture" (arXiv:2603.16021, March 2026), co-authored with David McDermott.

He runs a 15,700-member community called "Clief Notes" on Skool, operates 10 YouTube channels (all produced by an ICM-powered pipeline while he sleeps), and publishes on Substack. His teaching follows a three-tier model: "The Foundation" (free: concepts, folder architecture, prompting), "Implementation Playbooks" (building real things), and "Building Your Stack" (custom tools).

His background matters: he comes from systems engineering and military operational planning, not Silicon Valley product culture. This shapes his entire approach --- everything is about mission-structure, clarity of orders, and observable state.

---

## 2. The Core Insight (Shared With Agent OS)

Van Clief's central observation is identical to ours:

> "If prompts and context for each stage of a workflow already exist as files in a well-organized folder hierarchy, you do not need a coordination framework to manage multiple specialized agents. You need one orchestrating agent that reads the right files at the right moment."

The folder structure IS the orchestration layer. Not code. Not a framework. Not a database. Files and folders on disk.

He goes further: "The principles that made Unix pipelines effective in the 1970s apply directly to AI agent orchestration in the 2020s." Specifically:
- Programs that do one thing (McIlroy's Unix principle)
- Output of one becomes input of another (pipe-and-filter)
- Plain text as universal interface (Kernighan and Pike)
- Human-readable intermediate state (Plan 9's "everything is a file")

---

## 3. The Five Design Principles of ICM

These are the load-bearing ideas in Van Clief's system:

### Principle 1: One Stage, One Job

Each stage in a workspace handles a single step and writes its output to its own folder. A stage that fetches data does not also filter it. A stage that filters does not also format the final output. This follows McIlroy's Unix principle AND Parnas's information-hiding criterion.

**Implication for Agent OS:** Our `actions/` concept maps to this, but we don't enforce single-responsibility at the action level. An action README could instruct an agent to do five things in sequence. Van Clief would say: break that into five stages, each with its own folder, so humans can review and intervene between each one.

### Principle 2: Plain Text as the Interface

Stages communicate through markdown and JSON files. No binary formats, no database connections, no proprietary serialization. Any tool that can read a text file can participate. Any human who can open a text editor can inspect or modify any artifact.

**Implication for Agent OS:** We already do this (YAML, Markdown). We're aligned here. But Van Clief's insight goes further --- the reason for plain text isn't just accessibility. It's that plain text makes the system *observable by default*. You don't need logging dashboards or instrumentation. You just open the folder and read the files.

### Principle 3: Layered Context Loading

Agents load ONLY the context they need for the current stage. Less irrelevant context means better model performance. This is prevention (don't load it) rather than treatment (compress it after loading).

Van Clief cites the "Lost in the Middle" research (Liu et al., 2024): LLMs perform significantly worse when relevant information is buried in the middle of long contexts. ICM keeps context windows to 2,000-8,000 tokens per stage versus 30,000-50,000 for monolithic approaches.

**This is ICM's most technically rigorous contribution and the biggest gap in Agent OS.** We have no concept of layered context loading. Our CLAUDE.md dumps everything into one context. Van Clief's five-layer system is:

- **Layer 0: CLAUDE.md** (~800 tokens) --- "Where am I?" Global identity, workspace orientation.
- **Layer 1: CONTEXT.md** (~300 tokens) --- "Where do I go?" Workspace-level task routing.
- **Layer 2: Stage CONTEXT.md** (~200-500 tokens) --- "What do I do?" The contract for one step.
- **Layer 3: Reference material** (500-2k tokens) --- "What rules apply?" Stable design systems, voice guides, domain knowledge. Configured once. The factory.
- **Layer 4: Working artifacts** (varies) --- "What am I working with?" Previous outputs, source material. Changes every run. The product.

The Layer 3 / Layer 4 distinction is particularly powerful. Reference material (Layer 3) should be internalized as constraints: "write like this, use these colors, follow these conventions." Working artifacts (Layer 4) should be processed as input: "transform this research into a script." Mixing them in an undifferentiated context window forces the model to sort them on its own. Separating them in the folder structure means the model receives already-organized context.

### Principle 4: Every Output Is an Edit Surface

The intermediate output of each stage is a file a human can open, read, edit, and save before the next stage runs. This implements Horvitz's mixed-initiative principles: the human works with visible, manipulable objects, and the system picks up whatever the human left there.

**Implication for Agent OS:** Our `log/` folder captures exhaust after the fact. Van Clief's `output/` folders are different --- they're the handoff mechanism between stages. The output IS the intermediate state, not a log of what happened. Humans are expected to edit these files before the next stage picks them up.

### Principle 5: Configure the Factory, Not the Product

A workspace is set up once with user preferences, brand, style, and structural decisions. After that, each run of the pipeline produces a new deliverable using the same configuration. This follows the continuous delivery principle that production pipelines should be repeatable.

Van Clief separates this into:
- **Setup (one-time):** `setup/questionnaire.md` --- flat, all-at-once, system-level configuration
- **Config (stable):** `_config/` --- brand, voice, design system
- **Shared (stable):** `shared/` --- cross-stage resources
- **Skills (stable):** `skills/` --- domain knowledge bundles

**Implication for Agent OS:** Our `context/` folder mixes factory configuration with per-run input. Van Clief would say: separate them. The company overview is factory configuration (rarely changes). The current task brief is working material (changes every time). They need different folder locations because the model should treat them differently.

---

## 4. The Architecture in Detail

### Workspace Structure

```
workspace/
├── CLAUDE.md                  (Layer 0: global identity)
├── CONTEXT.md                 (Layer 1: task routing)
├── stages/
│   ├── 01_research/
│   │   ├── CONTEXT.md         (Layer 2: stage contract)
│   │   ├── references/        (Layer 3: stable rules)
│   │   └── output/            (Layer 4: working artifacts)
│   ├── 02_script/
│   │   ├── CONTEXT.md
│   │   ├── references/
│   │   └── output/
│   └── 03_production/
│       ├── CONTEXT.md
│       ├── references/
│       └── output/
├── _config/                   (Layer 3: brand, voice, design)
├── shared/                    (Layer 3: cross-stage resources)
├── skills/                    (Layer 3: domain knowledge)
└── setup/
    └── questionnaire.md       (one-time configuration)
```

Key structural rules:
- **Numbered folders encode execution sequence.** No orchestration code needed.
- **output/ of stage N becomes input for stage N+1.** The filesystem IS the handoff.
- **One-way dependencies.** If stage A references stage B, B never references A.
- **Selective section routing.** Load specific sections, not entire files.
- **Canonical sources.** Single authoritative location per piece of information.

### Stage Contract (CONTEXT.md)

Each stage's CONTEXT.md is a contract with three parts:

```markdown
## Inputs
- Layer 4 (working): ../01_research/output/
- Layer 3 (reference): ../../_config/voice.md
- Layer 3 (reference): references/structure.md

## Process
Write a script based on the research output.
Follow the structure in structure.md.
Match the tone described in voice.md.

## Outputs
- script_draft.md -> output/
```

The Inputs table explicitly distinguishes between Layer 3 files (reference, same every run) and Layer 4 files (working, specific to this run). This makes the selection explicit, editable, and auditable.

### Pipeline Flow with Review Gates

```
Stage 1 (Research) → [output/] → Human Review → Stage 2 (Script) → [output/] → Human Review → Stage 3 (Production) → [output/]
```

At each boundary, the human reviews the output. The same model executes every stage; the folder structure controls what context it receives.

---

## 5. What ICM Does That Agent OS Doesn't (Gaps)

### Gap 1: Layered Context Architecture

Agent OS has CLAUDE.md / AGENT.md as a flat entry point. ICM has a five-layer hierarchy where each layer answers a different question and has a different token budget. This is the single most important architectural difference.

**What to adopt:** Introduce a routing layer (equivalent to Layer 1 CONTEXT.md) that tells the agent which task goes where and what resources exist. Currently our CLAUDE.md tries to be both Layer 0 (identity) and Layer 1 (routing) simultaneously.

### Gap 2: Stage-Based Workflow Decomposition

Agent OS has a flat task list (list.yml). ICM has numbered stage folders where the output of one stage feeds the next. Agent OS treats tasks as independent items to check off. ICM treats work as a pipeline with intermediate artifacts.

**What to adopt:** For repeatable workflows (content production, research, reporting), introduce the concept of "workspace templates" --- numbered stage folders with contracts, reference material, and output directories. These would live alongside or within the existing actions/ structure.

### Gap 3: The Factory/Product Separation

Agent OS mixes stable business context (company info, brand, competitors) with per-run working material in the same `context/` folder. ICM separates them because the model should process them differently:
- Reference material (factory) → internalize as constraints
- Working artifacts (product) → process as input

**What to adopt:** Within context/, distinguish between `context/config/` (stable, factory-level, changes rarely) and context sources that change frequently. Or more practically: mirror ICM's approach of `_config/`, `shared/`, and `skills/` as top-level siblings to `context/`.

### Gap 4: Explicit Human Review Gates

Agent OS marks tasks as needing "founder input" but doesn't structurally enforce review between pipeline stages. ICM makes review gates architectural --- the output/ folder is the review surface, and nothing proceeds until the human is done.

**What to adopt:** For multi-step workflows, make the handoff explicit. The output of step 1 goes to a specific location. The human edits it there. Step 2 reads from that same location. No separate "approval" mechanism needed --- the filesystem IS the approval mechanism.

### Gap 5: Token-Conscious Design

ICM is explicitly designed around context window efficiency. Each stage gets 2,000-8,000 tokens of focused context. Agent OS has no explicit consideration for token budgets in its architecture.

**What to adopt:** Not necessarily hard token limits, but the principle of selective loading. The agent shouldn't load all of context/ for every task. The task should specify which context sources it needs (we already have this in list.yml's `context:` field --- but there's no mechanism for the agent to load selectively).

### Gap 6: Self-Documenting Architecture

In ICM, the CONTEXT.md files that instruct the agent are simultaneously the documentation that tells a human what the stage does. The instruction set and the documentation are the same artifact.

**What to adopt:** Our action READMEs do this partially. But stage contracts in ICM go further --- they specify exact inputs, process steps, and outputs. A new person can read the CONTEXT.md files top to bottom and understand the entire pipeline without running it.

---

## 6. What Agent OS Does That ICM Doesn't (Strengths to Keep)

### Strength 1: Business-Wide Scope

ICM is designed for individual workflows (content pipeline, research pipeline). Agent OS is designed for the entire business. We have company context, customer data, competitor analysis, website context --- the whole business knowledge graph. ICM has no equivalent of this.

### Strength 2: Permission Boundaries

Agent OS explicitly separates read (context) from write (actions). An agent can read context/website but can only modify it through actions/edit-website with specific instructions. ICM doesn't model permission boundaries --- any stage can write to its output folder.

### Strength 3: Registry-Based Discovery

Agent OS has context/registry.yml and actions/registry.yml as indexes. This means an agent can discover what's available without traversing the filesystem. ICM relies on the agent reading the folder structure directly.

### Strength 4: Multi-Agent / Multi-Tool Flexibility

Agent OS is designed to work with any agent (Claude, GPT, etc.) entering through AGENT.md. It's also designed to work alongside a web app. ICM is more opinionated --- it's built specifically for Claude Code's session model.

### Strength 5: Task Queue vs. Pipeline

Agent OS's list.yml is a flexible task queue that handles ad-hoc work, not just sequential pipelines. Real businesses have a mix: repeatable pipelines AND one-off tasks. ICM only handles the pipeline case well.

---

## 7. Van Clief's Broader Thinking (From Substack & Community)

### Computational Orchestration

Van Clief defines "computational orchestration" as the strategic coordination of different computation types --- traditional code, LLMs, human judgment, and emerging technologies. His key insight: "A simple regex in the right spot beats GPT-4 in the wrong spot." The discipline is knowing which computation fits which problem.

His practical example: one client project achieved optimal results through 60% database queries, 30% if-then logic, and 10% AI calls. The 10% AI created the perceived magic; the 90% traditional code enabled it.

### The Orchestration Imperative

His analysis of consulting's future argues that when answers become commodified (AI-generated instantly), the premium skill becomes "question architecture" --- teaching organizations how to ask better questions and building internal solution-generation capabilities.

The 70-20-10 success formula for AI transformation: 70% people/processes, 20% technology/data, 10% algorithms. The best returns come from superior orchestrators, not superior AI.

### The Great AI Paradox

AI is simultaneously the most overhyped technology and the most underappreciated transformation. His survival framework for AI companies: "Infrastructure beats innovation. Business fundamentals beat brilliant demos. Solving real problems beats solving theoretical ones."

---

## 8. Practitioner Evidence

ICM has been tested by a community of 52 practitioners across content creation, training material development, research analysis, and policy workflows. Key findings:

### U-Shaped Human Intervention Pattern

Across 33 practitioners using multi-stage workspaces, 30 reported:
- **Stage 1 output (Research):** 92% edit almost always. This is directional --- narrowing from broad possibilities to a specific angle. Creative judgment.
- **Stage 2 output (Script):** 30% edit sometimes. Middle stages get lightest touch because they sit between well-defined anchors.
- **Stage 3 output (Production):** 78% edit almost always. This is alignment work --- checking that the output faithfully represents decisions made earlier. Closer to debugging.

This is powerful evidence for the review gate architecture: intervention is most valuable at the beginning (setting direction) and end (verifying alignment), not in the middle.

### Non-Technical User Accessibility

Three community members with no coding experience used ICM's workspace-builder to create workspaces that produced ten-minute animated videos from scripts. They edited CONTEXT.md files, reviewed stage outputs, and iterated without developer assistance.

### Workspace Duplication Pattern

Users duplicate working workspaces and modify the stage prompts to target different content formats (short explainers → long-form essays). This mirrors how Unix users build new shell scripts by modifying existing ones.

---

## 9. Where ICM Falls Short (Honest Assessment)

Van Clief is candid about limitations:

1. **No real-time multi-agent collaboration.** ICM is sequential and file-based. If agents need to communicate dynamically in tight loops, you need message-passing infrastructure.

2. **No high-concurrency.** ICM is local-first by design. Multiple users hitting the same pipeline simultaneously needs proper queueing.

3. **No automated branching.** A human can decide between stages, but automated conditional logic would require scripting that moves ICM toward being a framework.

4. **No traceability yet.** You can see what each stage produced, but you can't trace a specific phrase in the final output back to the source instruction that caused it. Van Clief proposes "output provenance through identifiers" and "cross-stage trace verification" as future work.

5. **Single model family tested.** All evaluation used Claude (Opus 4.6 and Sonnet 4.6). Cross-model performance is an open question.

---

## 10. Synthesis: What Agent OS Should Adopt

### High Priority (Architectural Changes)

1. **Introduce layered context loading.** Split AGENT.md into Layer 0 (identity/orientation) and a new Layer 1 routing file (what goes where, what resources exist). This is the most impactful change.

2. **Add the factory/product distinction to context/.** Separate stable business context (company, brand, competitors) from per-run working material. Even a subfolder convention (`context/_config/` vs. `context/working/`) would help.

3. **Create workspace templates for repeatable workflows.** When an action is a pipeline (content creation, research, reporting), represent it as numbered stage folders with contracts. This is the natural evolution of actions/.

### Medium Priority (Convention Improvements)

4. **Make stage contracts explicit.** For pipeline-style actions, adopt the Inputs/Process/Outputs contract format in action READMEs. Specify exactly which context sources and which sections the agent should load.

5. **Introduce output/ directories as handoff points.** Rather than logging to log/, have stage outputs go to explicit output/ folders that become the next stage's input. This makes intermediate state visible and editable.

6. **Add review gates to multi-step workflows.** When a task has multiple stages, the system should pause between stages for human review. The filesystem structure (output/ folders) makes this natural.

### Lower Priority (Nice to Have)

7. **Token budget awareness.** Document approximate token costs for context sources so agents (and humans) can make informed loading decisions.

8. **Setup questionnaires.** Van Clief's `setup/questionnaire.md` pattern is useful for onboarding --- one-time configuration that captures voice, style, and structural decisions.

9. **Skills as domain knowledge bundles.** ICM's skills/ concept (stable domain knowledge that persists across runs) maps well to Agent OS's context/ but with clearer packaging.

---

## 11. Key Quotes Worth Remembering

> "The simplest viable architecture for this class of problem is one that already exists on every computer: the filesystem."

> "This is going backward before going forward. The principles that made Unix pipelines effective in the 1970s apply directly to AI agent orchestration in the 2020s."

> "ICM trades the flexibility of a programmatic orchestrator for the portability, inspectability, and editability of plain files. That tradeoff is the point."

> "A production pipeline where every intermediate output is a readable file is inherently interpretable. There is nothing to explain because nothing was hidden."

> "The workspace definition is the system. There is no separate deployment artifact."

> "If workspaces are only as good as the last human edit of their output, they remain tools. If workspaces improve their own source files over time, incorporating the patterns they learn from human corrections, they become systems that get better with use."

---

## Sources

- [ICM Paper (arXiv:2603.16021)](https://arxiv.org/abs/2603.16021)
- [ICM GitHub Repository](https://github.com/RinDig/Interpreted-Context-Methdology)
- [Jake Van Clief's Substack](https://jakevanclief.substack.com/)
- [Clief Notes Community (Skool)](https://www.skool.com/quantum-quill-lyceum-1116)
- [The Great AI Paradox (Substack)](https://jakevanclief.substack.com/p/the-great-ai-paradox)
- [The Orchestration Imperative (Substack)](https://jakevanclief.substack.com/p/the-orchestration-imperative)
- [The Rise of Computational Orchestration (Substack)](https://jakevanclief.substack.com/p/the-rise-of-computational-orchestration)
- ["How I Structure Folders to Replace AI Agents" (Skool post)](https://www.skool.com/quantum-quill-lyceum-1116/new-video-how-i-structure-folders-to-replace-ai-agents)
- [LinkedIn: Building Codeless Apps with Coding Agents](https://www.linkedin.com/posts/jake-van-clief-74b66915a_github-rindigmodel-workspace-protocol-mwp-activity-7431684813683683328-bDkB)
