---
name: onboarding
description: >
  Set up a new project with the Agent OS convention — lists, context, and actions folders. Use this skill whenever the user wants to onboard a business, structure a new project, set up agent-os, bootstrap their business context, or says something like "help me set up this project" or "onboard my business." Also trigger when the CLAUDE.md references running /onboarding and the lists/, context/, or actions/ folders are missing or empty.
---

# Onboarding

This skill bootstraps a project into the Agent OS convention: three folders (lists, context, actions) that make a business fully legible to any AI agent.

## When to run

Run this skill when:
- The project has a CLAUDE.md referencing lists/, context/, and actions/ but those folders are missing or empty
- The user asks to set up, onboard, or structure their project
- The user says "run onboarding" or "/onboarding"

Do NOT run this skill if all three folders already exist and contain meaningful content. In that case, just read the CLAUDE.md and start working.

## How it works

Onboarding has two phases: **scan** and **ask**. The goal is to populate the three folders with enough content that an agent can immediately start working after onboarding completes.

### Phase 1: Scan

Before asking the user anything, look at what already exists in the project directory. Read every file you can find — markdown, YAML, JSON, code, configs, READMEs. You're looking for:

- **Business facts**: What does this business do? Who does it serve? What's the product? Look for README files, about pages, marketing copy, package.json descriptions, config files with project names.
- **Existing task lists**: Any TODO files, issue trackers, project boards exported as files, roadmap documents, task lists in markdown.
- **Existing documentation**: Style guides, brand guidelines, onboarding docs, SOPs, runbooks, API documentation.
- **Code and infrastructure**: What tech stack is used? What services are connected? Look at package.json, requirements.txt, docker-compose, CI configs, deployment scripts.
- **Credentials and secrets patterns**: Note what services are referenced in .env.example or config files (don't read actual .env files). This tells you what external tools the business uses.

Summarize what you found before moving to Phase 2. Tell the founder: "Here's what I found in your project. Let me ask you a few questions to fill in the gaps."

### Phase 2: Ask

Based on what you found (or didn't find) in Phase 1, ask the founder targeted questions. Don't ask things you already know from scanning. Focus on gaps.

Core questions (skip any you can already answer from the scan):

1. **What does your business do?** Who are your customers? What's the product or service?
2. **What are you working on right now?** What's in progress, what's next, what's blocked?
3. **What tools and platforms do you use?** Website hosting, email, payments, social media, analytics, project management, communication tools.
4. **What recurring work do you do?** Weekly newsletters, content publishing, customer outreach, reporting, invoicing — anything that happens on a schedule.
5. **What would you want an agent to help with first?** This helps prioritize the initial task list.

Keep it conversational. Don't overwhelm with all questions at once — ask the most important 2-3 based on what's missing, then follow up naturally.

### Phase 3: Build

Once you have enough context, create the three folders:

#### lists/

Create at least one list file with real tasks based on what the founder told you. The list should include both agent tasks and founder tasks (decisions, approvals, things only a human can do).

Use the simplest format that fits. For most new businesses, a single markdown checklist is enough:

```markdown
# Current Sprint

- [ ] Set up analytics tracking ← agent
- [ ] Decide on pricing tiers ← founder (needs decision)
- [ ] Write landing page copy ← agent
- [ ] Review and approve copy ← founder
```

If the business has multiple workstreams, create separate list files for each.

#### context/

Create folders for each distinct topic area. At minimum, create `context/company/` with a README.md that captures the business basics — what it does, who it serves, how it operates. Then create any other context folders that make sense based on what you learned:

- `context/brand/` — if there's any brand voice, style, or visual identity information
- `context/customers/` — if there's any customer data or segmentation info
- `context/website/` — if there's a website to manage
- Any other topic that came up in the conversation

Each folder gets at minimum a README.md explaining what's in it. Populate with whatever real content you gathered — don't create empty placeholder folders.

Place stable business identity files in `context/_config/`. This includes company overview, brand voice, and any guidelines that won't change between tasks. Create at minimum `context/_config/company.md`.

Other context folders (customers/, competitors/, website/) go directly under context/ as before.

#### actions/

Create action folders for things the founder mentioned they want to do. Each action gets a README.md explaining:
- What the action does
- What it targets (a repo, a service, a file)
- Step-by-step instructions for how to execute it
- What context to read before executing

Only create actions for things that are real and known. If the founder mentioned they have a website on GitHub, create `actions/edit-website/`. If they mentioned sending newsletters via Mailchimp, create `actions/send-newsletter/`. Don't create speculative actions for things that haven't been discussed.

If the founder described any repeatable multi-step workflows (e.g., weekly content production, client reporting, research pipelines), consider creating these as pipeline actions with numbered stage folders. Only do this if the workflow clearly has distinct stages with different inputs and outputs. Most actions should remain simple single-README folders.

### Phase 4: Confirm

After building the initial structure, give the founder a summary of what was created:

- How many lists, what they contain
- What context folders were created and what's in each
- What actions were set up

Ask: "Does this look right? Anything missing or wrong?"

Make adjustments based on their feedback. Then you're done — the project is onboarded and ready for work.

## Principles

- **Start lean.** A single list, two context folders, and one action is a perfectly valid starting point. Don't over-scaffold.
- **Use real content.** Every file should contain actual, useful information — not placeholder text. If you don't have enough info for a folder, don't create it.
- **Match the business complexity.** A solo founder with one product needs a simpler structure than an agency with multiple clients. Let the founder's answers guide the complexity.
- **Don't invent business facts.** If you're unsure about something, ask. Never guess at what the business does or how it operates.
- **Never store secrets.** No API keys, passwords, or tokens in any file. If you learn about services the business uses, document the service name and how to use it, not the credentials.
