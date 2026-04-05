/**
 * agent-os server
 *
 * A thin server that:
 * 1. Reads files from an ops directory and serves them to the UI
 * 2. Manages context and action registries from the filesystem
 * 3. Starts agent runs and streams output to the browser via SSE
 *
 * The filesystem IS the database. This server just observes it.
 */

import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { serve } from '@hono/node-server'
import { appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { resolve, join, relative, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { ClaudeCodeProvider } from './providers/claude-code.js'

// ── Config ──────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10)
// Default ops root: <repo>/ops (server lives at <repo>/app/server/{src|dist})
const DEFAULT_OPS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'ops')
const OPS_DIR = resolve(process.env.OPS_DIR ?? DEFAULT_OPS_DIR)
const provider = new ClaudeCodeProvider()
const CONTEXT_REGISTRY_PATH = join(OPS_DIR, 'context', 'registry.yml')
const CONTEXT_SOURCES_DIR = join(OPS_DIR, 'context')
const CONTEXT_LOGS_DIR = join(OPS_DIR, 'log', 'context-onboarding')
const ACTIONS_DIR = join(OPS_DIR, 'actions')
const ACTIONS_REGISTRY_PATH = join(ACTIONS_DIR, 'registry.yml')

type ContextEntry = Record<string, unknown> & {
  id?: string
  name?: string
  type?: string
  description?: string
  path?: string
  provider?: string
  status?: string
  origin?: unknown
  artifacts?: unknown
  editable?: boolean
  default_action_id?: string
}

type ActionTarget = {
  kind?: string
  location?: string
  cwd?: string
}

type ActionEntry = Record<string, unknown> & {
  id?: string
  name?: string
  status?: string
  path?: string
  context_id?: string
  auto_created?: boolean
  instructions?: string
  target?: ActionTarget
}

type QueueTask = Record<string, unknown> & {
  id?: string
  title?: string
  status?: string
  priority?: string
  why?: string
  description?: string
  owner?: string
  clarification_needed?: boolean
  context?: string[]
  actions?: string[]
  depends_on?: string[]
}

// ── Helpers ──────────────────────────────────────────────

const QUEUE_PATH = join(OPS_DIR, 'list.yml')

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

function normalizeTask(input: Record<string, unknown>): QueueTask {
  return {
    ...input,
    id: typeof input.id === 'string' ? input.id : undefined,
    title: typeof input.title === 'string' ? input.title : undefined,
    status: typeof input.status === 'string' && input.status.trim() ? input.status : 'ready',
    priority: typeof input.priority === 'string' ? input.priority : undefined,
    why: typeof input.why === 'string' ? input.why : undefined,
    description: typeof input.description === 'string' ? input.description : undefined,
    owner: typeof input.owner === 'string' ? input.owner : undefined,
    clarification_needed: Boolean(input.clarification_needed),
    context: normalizeStringArray(input.context),
    actions: normalizeStringArray(input.actions),
    depends_on: normalizeStringArray(input.depends_on),
  }
}

async function readTaskQueue(): Promise<QueueTask[]> {
  try {
    const raw = await readFile(QUEUE_PATH, 'utf-8')
    const parsed = parseYaml(raw) as { list?: Array<Record<string, unknown>> }
    return (parsed?.list ?? []).map(normalizeTask)
  } catch {
    return []
  }
}

async function readRawTaskQueue(): Promise<Array<Record<string, unknown>>> {
  try {
    const raw = await readFile(QUEUE_PATH, 'utf-8')
    const parsed = parseYaml(raw) as { list?: Array<Record<string, unknown>> }
    return parsed?.list ?? []
  } catch {
    return []
  }
}

async function writeTaskQueue(tasks: QueueTask[]) {
  await writeFile(QUEUE_PATH, stringifyYaml({ list: tasks }), 'utf-8')
}

async function updateTaskStatus(taskId: string, status: string) {
  const tasks = await readTaskQueue()

  const task = tasks.find(t => t.id === taskId)
  if (!task) return

  task.status = status

  if (status === 'done') {
    // Archive to log/completed.md and remove from list
    await archiveTask(task)
    await writeTaskQueue(tasks.filter(t => t.id !== taskId))
    return
  }

  await writeTaskQueue(tasks)
}

async function archiveTask(task: Record<string, unknown>) {
  const completedPath = join(OPS_DIR, 'log', 'completed.md')
  const date = new Date().toISOString().split('T')[0]
  const id = String(task.id ?? '')
  const title = String(task.title ?? '')
  const desc = String(task.description ?? task.why ?? '').trim().slice(0, 120)
  const row = `| ${date} | ${id} | ${title} | ${desc} |\n`

  try {
    await appendFile(completedPath, row, 'utf-8')
  } catch {
    // File doesn't exist yet — create with header
    await mkdir(join(OPS_DIR, 'log'), { recursive: true })
    const header = [
      '# Completed Work Archive\n',
      'Items moved here from list.yml when done. Append-only — never edit past entries.\n',
      '| Date | ID | Title | Result |',
      '|------|-----|-------|--------|\n',
    ].join('\n')
    await writeFile(completedPath, header + row, 'utf-8')
  }
}

async function readContextRegistry(): Promise<ContextEntry[]> {
  try {
    const raw = await readFile(CONTEXT_REGISTRY_PATH, 'utf-8')
    const parsed = parseYaml(raw) as { context?: ContextEntry[] }
    return parsed?.context ?? []
  } catch {
    return []
  }
}

async function writeContextRegistry(entries: ContextEntry[]) {
  await writeFile(CONTEXT_REGISTRY_PATH, stringifyYaml({ context: entries }), 'utf-8')
}

async function readActionRegistry(): Promise<ActionEntry[]> {
  try {
    const raw = await readFile(ACTIONS_REGISTRY_PATH, 'utf-8')
    const parsed = parseYaml(raw) as { actions?: ActionEntry[] }
    return parsed?.actions ?? []
  } catch {
    return []
  }
}

async function writeActionRegistry(entries: ActionEntry[]) {
  await mkdir(ACTIONS_DIR, { recursive: true })
  await writeFile(ACTIONS_REGISTRY_PATH, stringifyYaml({ actions: entries }), 'utf-8')
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'item'
}

function uniqueId(base: string, existingIds: Set<string>): string {
  let candidate = slugify(base)
  let counter = 2
  while (existingIds.has(candidate)) {
    candidate = `${slugify(base)}-${counter}`
    counter += 1
  }
  return candidate
}

function normalizeActionStatus(status: unknown, target?: ActionTarget): string {
  if (typeof status === 'string' && status.trim()) return status
  if (target?.location?.trim()) return 'active'
  return 'needs_setup'
}

function normalizeActionEntry(input: Record<string, unknown>, id: string): ActionEntry {
  const inputTarget = typeof input.target === 'object' && input.target !== null
    ? input.target as Record<string, unknown>
    : {}
  const kind = typeof inputTarget.kind === 'string' && inputTarget.kind.trim()
    ? inputTarget.kind.trim()
    : 'filesystem'
  const location = typeof inputTarget.location === 'string' ? inputTarget.location.trim() : ''
  const cwd = typeof inputTarget.cwd === 'string' && inputTarget.cwd.trim() ? inputTarget.cwd.trim() : undefined
  const target: ActionTarget = { kind, location, ...(cwd ? { cwd } : {}) }

  const action: ActionEntry = {
    ...input,
    id,
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : `Action ${id}`,
    status: normalizeActionStatus(input.status, target),
    path: `actions/${id}`,
    auto_created: Boolean(input.auto_created),
    instructions: typeof input.instructions === 'string' ? input.instructions.trim() : '',
    target,
  }

  if (typeof input.context_id === 'string' && input.context_id.trim()) {
    action.context_id = input.context_id.trim()
  } else {
    delete action.context_id
  }

  return action
}

async function syncActionArtifacts(action: ActionEntry) {
  if (!action.id) return

  const actionDir = join(ACTIONS_DIR, action.id)
  const target = action.target ?? {}
  const readme = [
    `# ${action.name ?? action.id}`,
    '',
    `**Status:** ${action.status ?? 'needs_setup'}`,
    `**Auto Created:** ${action.auto_created ? 'yes' : 'no'}`,
    ...(action.context_id ? [`**Linked Context:** \`${action.context_id}\``] : []),
    '',
    '## Target',
    `- Kind: ${target.kind ?? 'filesystem'}`,
    `- Location: ${target.location?.trim() || '(not configured)'}`,
    ...(target.cwd ? [`- Working Directory: ${target.cwd}`] : []),
    '',
    '## Instructions',
    action.instructions?.trim() || 'No additional instructions.',
    '',
  ].join('\n')

  await mkdir(actionDir, { recursive: true })
  await writeFile(join(actionDir, 'README.md'), readme, 'utf-8')
  await writeFile(join(actionDir, 'action.yml'), stringifyYaml(action), 'utf-8')
}

function describeContextSource(source: ContextEntry): string {
  const parts = [`- ${source.name ?? source.id ?? 'Unknown'} (${source.type ?? 'unknown'})`]
  if (source.status) parts.push(`  Status: ${source.status}`)
  if (typeof source.editable === 'boolean') parts.push(`  Editable: ${source.editable ? 'yes' : 'no'}`)
  if (source.default_action_id) parts.push(`  Default action: ${source.default_action_id}`)
  if (source.description) parts.push(`  ${source.description}`)
  if (source.path) parts.push(`  Path: ${source.path}`)
  if (source.provider) parts.push(`  Provider: ${source.provider}`)
  if (source.origin) {
    const origin = typeof source.origin === 'string' ? source.origin : stringifyYaml(source.origin).trim()
    parts.push(`  Origin: ${origin}`)
  }
  if (Array.isArray(source.artifacts) && source.artifacts.length > 0) {
    parts.push(`  Artifacts: ${(source.artifacts as unknown[]).map(String).join(', ')}`)
  }
  return parts.join('\n')
}

function describeAction(action: ActionEntry): string {
  const parts = [`- ${action.name ?? action.id ?? 'Unknown'} (${action.status ?? 'needs_setup'})`]
  if (action.context_id) parts.push(`  Linked context: ${action.context_id}`)
  if (action.auto_created) parts.push('  Auto-created: yes')
  if (action.target?.kind) parts.push(`  Target kind: ${action.target.kind}`)
  if (action.target?.location) parts.push(`  Target location: ${action.target.location}`)
  if (action.target?.cwd) parts.push(`  Target cwd: ${action.target.cwd}`)
  if (action.instructions) parts.push(`  Instructions: ${action.instructions}`)
  return parts.join('\n')
}

function normalizeActionPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return resolve(OPS_DIR, trimmed)
}

function collectActiveActionPaths(actions: ActionEntry[]): string[] {
  const paths = new Set<string>()

  for (const action of actions) {
    const location = normalizeActionPath(action.target?.location)
    const cwd = normalizeActionPath(action.target?.cwd)
    if (location) paths.add(location)
    if (cwd) paths.add(cwd)
  }

  return [...paths]
}

async function loadContextBundle(source: ContextEntry): Promise<string> {
  if (!source.path || typeof source.path !== 'string') return describeContextSource(source)

  const candidates = [
    join(OPS_DIR, source.path, 'README.md'),
    join(OPS_DIR, source.path, 'source.yml'),
    join(OPS_DIR, source.path, 'requirements.md'),
  ]

  const sections: string[] = []
  for (const candidate of candidates) {
    try {
      const content = await readFile(candidate, 'utf-8')
      sections.push(`--- ${relative(OPS_DIR, candidate)} ---\n${content}`)
    } catch {
      continue
    }
  }

  return sections.length > 0 ? sections.join('\n\n') : describeContextSource(source)
}

async function loadLegacyContextRef(ref: string): Promise<string | null> {
  const fullPath = join(OPS_DIR, ref)

  try {
    const info = await stat(fullPath)
    if (info.isDirectory()) {
      const candidates = ['README.md', 'source.yml', 'requirements.md']
      const sections: string[] = []
      for (const candidate of candidates) {
        try {
          const candidatePath = join(fullPath, candidate)
          const content = await readFile(candidatePath, 'utf-8')
          sections.push(`--- ${relative(OPS_DIR, candidatePath)} ---\n${content}`)
        } catch {
          continue
        }
      }
      if (sections.length > 0) return sections.join('\n\n')
      return `--- ${ref} ---\n(directory with no readable manifest files)`
    }

    const content = await readFile(fullPath, 'utf-8')
    return `--- ${ref} ---\n${content}`
  } catch {
    return null
  }
}

async function resolveTaskContext(task: QueueTask, contextRegistry: ContextEntry[]) {
  const sections: string[] = []
  const matchedIds: string[] = []
  const missing: string[] = []

  for (const ref of task.context ?? []) {
    const source = contextRegistry.find(entry => entry.id === ref)
    if (source) {
      matchedIds.push(ref)
      sections.push(await loadContextBundle(source))
      continue
    }

    const legacy = await loadLegacyContextRef(ref)
    if (legacy) {
      sections.push(legacy)
      continue
    }

    missing.push(ref)
  }

  return {
    content: sections.join('\n\n'),
    matchedIds,
    missing,
  }
}

// ── Per-task run registry (survives within the server process) ──────────
const taskRunRegistry = new Map<string, { sessionId?: string; result?: string; timestamp: number }>()

async function streamAgentExecution(
  c: Context,
  params: {
    prompt: string
    cwd: string
    systemPrompt: string
    resume?: string
    model?: string
    additionalDirectories?: string[]
    settings?: Record<string, unknown> | string
    sandbox?: Record<string, unknown>
    taskId?: string
  },
) {
  return streamSSE(c, async (stream) => {
    const { taskId } = params
    if (taskId) taskRunRegistry.set(taskId, { timestamp: Date.now() })

    try {
      for await (const message of provider.execute({ ...params, model: params.model })) {
        // Capture session ID as soon as it arrives
        if (taskId && message.type === 'session' && message.text) {
          const entry = taskRunRegistry.get(taskId) ?? { timestamp: Date.now() }
          taskRunRegistry.set(taskId, { ...entry, sessionId: message.text })
        }
        // Capture result text and persist to log file
        if (taskId && message.type === 'result' && message.text) {
          const entry = taskRunRegistry.get(taskId) ?? { timestamp: Date.now() }
          taskRunRegistry.set(taskId, { ...entry, result: message.text })
          try {
            const logPath = join(OPS_DIR, 'log', `${taskId}-last-run.md`)
            const sessionId = entry.sessionId ?? taskRunRegistry.get(taskId)?.sessionId ?? ''
            const content = [
              `# ${taskId} — Last Run`,
              `Date: ${new Date().toISOString()}`,
              sessionId ? `Session: ${sessionId}` : '',
              '',
              '## Result',
              message.text,
            ].filter(l => l !== undefined).join('\n')
            await writeFile(logPath, content, 'utf-8')
          } catch { /* log write failure is non-fatal */ }
        }
        await stream.writeSSE({
          event: message.type,
          data: JSON.stringify(message),
        })
      }
      await stream.writeSSE({ event: 'done', data: '{}' })
    } catch (err: unknown) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ text: err instanceof Error ? err.message : String(err) }),
      })
    }
  })
}

const CONTEXT_PRESET_HINTS: Record<string, string> = {
  website: 'Fetch public pages into local markdown artifacts under context/<id>/, summarize what the business does, and register the source.',
  repository: 'Use a canonical git remote URL as the source identity. Clone into context/<id>/repo/ only when that remote URL is explicitly provided, then document the structure in README.md and register the source.',
  folder: 'Use a canonical URL or durable external reference for the folder source when possible. If the source only exists as a local machine path, scaffold documentation and setup requirements instead of copying it.',
  file: 'Download or reference the file from a canonical URL when possible. If it only exists as a local machine path, scaffold documentation and setup requirements instead of copying it.',
  database: 'Scaffold documentation and requirements for the database connection under context/<id>/ without storing secrets.',
  api: 'Scaffold documentation and requirements for the API integration under context/<id>/ without storing secrets.',
  email: 'Scaffold documentation and requirements for the inbox integration under context/<id>/ without storing secrets.',
  mcp: 'Scaffold the MCP source, manifests, and setup docs under context/<id>/ without storing secrets.',
  custom: 'Choose a practical structure, create durable local artifacts under context/<id>/, and register the source.',
}

// ── App ─────────────────────────────────────────────────

const app = new Hono()

app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type'],
}))

// ── GET /api/board — read list.yml → return board state ──

app.get('/api/board', async (c) => {
  // Tasks from list.yml (the task board)
  const tasks = await readTaskQueue()

  // Context files
  let contextFiles: string[] = []
  try {
    contextFiles = await readdir(join(OPS_DIR, 'context'))
  } catch { /* no context dir */ }

  // Project name from CURRENT_STATE.md or folder name
  let name = basename(OPS_DIR)
  try {
    const cs = await readFile(join(OPS_DIR, 'context', 'current-state.md'), 'utf-8')
    const match = cs.match(/^([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\s+is\s+/m)
    if (match) name = match[1]
  } catch { /* use basename */ }

  return c.json({ tasks, contextFiles, name, opsDir: OPS_DIR })
})

// ── GET /api/context — return all context sources ───────

app.get('/api/context', async (c) => {
  return c.json({ context: await readContextRegistry() })
})

// ── POST /api/context — add a new context source ─────────

app.post('/api/context', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()
  if (!body.id || !body.type || !body.name) {
    return c.json({ error: 'id, name, and type are required' }, 400)
  }

  const entries = await readContextRegistry()
  if (entries.find(e => e.id === body.id)) {
    return c.json({ error: 'A context source with that id already exists' }, 409)
  }
  entries.push(body)

  await writeContextRegistry(entries)
  return c.json({ ok: true })
})

// ── PATCH /api/context/:id — update a context source ─────

app.patch('/api/context/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<Record<string, unknown>>()

  try {
    const entries = (await readContextRegistry()).map(e =>
      e.id === id ? { ...e, ...body, id } : e
    )
    await writeContextRegistry(entries)
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// ── DELETE /api/context/:id — remove a context source ────

app.delete('/api/context/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const entries = (await readContextRegistry()).filter(e => e.id !== id)
    const actions = (await readActionRegistry()).map(action =>
      action.context_id === id && action.auto_created
        ? { ...action, status: 'inactive' }
        : action
    )
    await writeContextRegistry(entries)
    await writeActionRegistry(actions)
    await Promise.all(actions.filter(action => action.context_id === id && action.auto_created).map(syncActionArtifacts))
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// ── GET /api/actions — return all actions ─────────────

app.get('/api/actions', async (c) => {
  return c.json({ actions: await readActionRegistry() })
})

// ── POST /api/actions — add an action ─────────────────

app.post('/api/actions', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return c.json({ error: 'name is required' }, 400)
  }

  try {
    const entries = await readActionRegistry()
    const existingIds = new Set(entries.map(entry => String(entry.id ?? '')))
    const id = typeof body.id === 'string' && body.id.trim()
      ? body.id.trim()
      : uniqueId(body.name, existingIds)

    if (existingIds.has(id)) {
      return c.json({ error: 'An action with that id already exists' }, 409)
    }

    const action = normalizeActionEntry(body, id)
    entries.push(action)

    await writeActionRegistry(entries)
    await syncActionArtifacts(action)

    return c.json({ ok: true, id })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// ── PATCH /api/actions/:id — update an action ─────────

app.patch('/api/actions/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<Record<string, unknown>>()

  try {
    const entries = await readActionRegistry()
    const index = entries.findIndex(entry => entry.id === id)
    if (index === -1) return c.json({ error: 'Action not found' }, 404)

    const action = normalizeActionEntry({ ...entries[index], ...body, id }, id)
    entries[index] = action

    await writeActionRegistry(entries)
    await syncActionArtifacts(action)

    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// ── DELETE /api/actions/:id — remove an action ────────

app.delete('/api/actions/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const actions = (await readActionRegistry()).filter(entry => entry.id !== id)
    const contexts = (await readContextRegistry()).map(context =>
      context.default_action_id === id
        ? { ...context, editable: false, default_action_id: undefined }
        : context
    )

    await writeActionRegistry(actions)
    await writeContextRegistry(contexts)

    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// ── GET /api/files — list all files as a tree ───────────

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

async function buildTree(dir: string, baseDir: string): Promise<FileNode[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nodes: FileNode[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const fullPath = join(dir, entry.name)
    const relPath = relative(baseDir, fullPath)

    if (entry.isDirectory()) {
      nodes.push({ name: entry.name, path: relPath, type: 'directory', children: await buildTree(fullPath, baseDir) })
    } else {
      nodes.push({ name: entry.name, path: relPath, type: 'file' })
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

app.get('/api/files', async (c) => {
  try {
    return c.json({ tree: await buildTree(OPS_DIR, OPS_DIR) })
  } catch {
    return c.json({ tree: [] }, 500)
  }
})

// ── GET /api/files/:path — read a single file ──────────

app.get('/api/files/*', async (c) => {
  const filePath = c.req.path.replace('/api/files/', '')
  if (!filePath) return c.json({ error: 'Path required' }, 400)

  const fullPath = join(OPS_DIR, filePath)
  if (!fullPath.startsWith(OPS_DIR)) return c.json({ error: 'Invalid path' }, 403)

  try {
    const info = await stat(fullPath)
    if (info.isDirectory()) return c.json({ error: 'Is a directory' }, 400)
    const content = await readFile(fullPath, 'utf-8')
    return c.json({ path: filePath, content })
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }
})

// ── POST /api/agent/start — launch Claude Code, stream output via SSE ──

app.post('/api/agent/start', async (c) => {
  const body = await c.req.json<{
    taskId: string
    prompt?: string
    comment?: string
    history?: Array<{ role: 'user' | 'agent'; text: string }>
    resume?: string
  }>()

  let taskInfo = ''
  let contextContent = ''
  const rawTaskQueue = await readRawTaskQueue()
  const rawTask = rawTaskQueue.find(entry => entry.id === body.taskId)
  const task = rawTask ? normalizeTask(rawTask) : undefined
  const contextRegistry = await readContextRegistry()
  const actionRegistry = await readActionRegistry()
  const hasExplicitActionScope = Boolean(rawTask && Object.prototype.hasOwnProperty.call(rawTask, 'actions'))

  if (task) {
    taskInfo = `Task: ${task.title}\nID: ${task.id}\nStatus: ${task.status}\n`
    if (task.priority) taskInfo += `Priority: ${task.priority}\n`
    if (task.description) taskInfo += `Description: ${task.description}\n`
    if (task.context?.length) taskInfo += `Context refs: ${task.context.join(', ')}\n`
    if (task.actions?.length) taskInfo += `Action refs: ${task.actions.join(', ')}\n`
    if (task.depends_on?.length) taskInfo += `Depends on: ${task.depends_on.join(', ')}\n`

    const resolvedContext = await resolveTaskContext(task, contextRegistry)
    contextContent = resolvedContext.content
    if (resolvedContext.missing.length > 0) {
      taskInfo += `Missing context refs: ${resolvedContext.missing.join(', ')}\n`
    }
  }

  const activeActions = actionRegistry.filter(action => action.status === 'active')
  const scopedActions = hasExplicitActionScope
    ? activeActions.filter(action => task?.actions?.includes(String(action.id ?? '')))
    : activeActions

  // Build prompt — if history present, reconstruct the conversation thread
  let prompt: string
  if (body.history && body.history.length > 0) {
    const thread = body.history
      .map(m => `[${m.role === 'user' ? 'User' : 'Agent'}]: ${m.text}`)
      .join('\n\n')
    const latest = body.comment?.trim() ?? ''
    prompt = `${taskInfo}${contextContent ? `\nContext:\n${contextContent}\n` : ''}Conversation so far:\n${thread}\n\n[User]: ${latest}`
  } else {
    prompt = body.prompt
      || `${taskInfo}${contextContent ? `\nContext:\n${contextContent}` : ''}${body.comment ? `\nUser instructions: ${body.comment}` : ''}`
  }

  if (!prompt.trim()) {
    return c.json({ error: 'Prompt is required' }, 400)
  }

  // Mark task in_progress before running
  try { await updateTaskStatus(body.taskId, 'in_progress') } catch { /* no queue */ }

  const contextLines = contextRegistry.map(describeContextSource)
  const actionLines = activeActions.map(describeAction)
  const scopedActionLines = scopedActions.map(describeAction)
  const actionAccessPaths = collectActiveActionPaths(scopedActions)
  const sessionSettings = actionAccessPaths.length
    ? {
        permissions: {
          defaultMode: 'acceptEdits',
          additionalDirectories: actionAccessPaths,
        },
      }
    : undefined
  const sandboxSettings = actionAccessPaths.length
    ? {
        enabled: true,
        autoAllowBashIfSandboxed: true,
        filesystem: {
          allowRead: actionAccessPaths,
          allowWrite: actionAccessPaths,
        },
      }
    : undefined

  const systemPrompt = [
    'You are working inside agent-os, a file-based business operating system.',
    `Your working directory is: ${OPS_DIR}`,
    '',
    'BOUNDARIES:',
    'All planning, logs, and agent-os state files belong inside this ops directory.',
    'Context is descriptive and read-only by default. Never infer write permission from context alone.',
    'Actions define what you may change and where you may change it.',
    'You may always modify files inside this ops directory.',
    'You may modify files outside this ops directory only when an explicit active action below allows it.',
    'If an action points to an original writable target, treat that target as canonical. Do not silently create, switch to, or edit a duplicate copy.',
    'If the work requires editing a source that has no active action, stop and tell the user:',
    '"This source needs an Action configured in the Actions tab first."',
    'If a task requires code or files that are not yet in context/, stop immediately and tell the user:',
    '"This source needs to be added via the Context tab first."',
    'Do not attempt workarounds, do not explore the filesystem, do not modify settings.',
    '',
    'The filesystem IS the database. You read and write YAML, CSV, and Markdown files.',
    `Tasks: ${join(OPS_DIR, 'list.yml')} — you MUST personally update the task status to "done" as your final action. Do not delegate this to a sub-agent. If you spawned sub-agents to do the work, you are still responsible for writing the status update yourself before finishing.`,
    `Context: ${join(OPS_DIR, 'context/')} — read model and context source manifests live here.`,
    `Actions: ${ACTIONS_REGISTRY_PATH} — write model and explicit writable targets live here.`,
    '',
    hasExplicitActionScope
      ? `This task declares explicit action scope: ${(task?.actions ?? []).join(', ') || '(none)'}.`
      : 'This task is legacy and has no explicit action scope; fallback to all active actions is enabled.',
    ...(contextLines.length ? [
      '',
      'Context sources available to you:',
      ...contextLines,
    ] : []),
    ...(scopedActionLines.length ? [
      '',
      'Actions available to you for this run:',
      ...scopedActionLines,
    ] : [
      '',
      'Actions available to you for this run:',
      '- None beyond files inside the ops directory.',
    ]),
    ...(actionLines.length ? [
      '',
      'All active actions registered in the instance:',
      ...actionLines,
    ] : [
      '',
      'All active actions registered in the instance:',
      '- None. You may only write inside the ops directory in this run.',
    ]),
  ].join('\n')

  return streamAgentExecution(c, {
    prompt,
    cwd: OPS_DIR,
    systemPrompt,
    resume: body.resume,
    additionalDirectories: actionAccessPaths,
    settings: sessionSettings,
    sandbox: sandboxSettings,
    taskId: body.taskId,
  })
})

// ── GET /api/tasks/:id/run — last run info (session ID + result) ─────────

app.get('/api/tasks/:id/run', async (c) => {
  const id = c.req.param('id')

  // Check in-memory registry first (current server session)
  const entry = taskRunRegistry.get(id)

  // Fall back to persisted log file
  if (!entry?.result) {
    try {
      const logPath = join(OPS_DIR, 'log', `${id}-last-run.md`)
      const content = await readFile(logPath, 'utf-8')
      // Parse session ID from log
      const sessionLine = content.split('\n').find(l => l.startsWith('Session:'))
      const sessionId = sessionLine?.replace('Session:', '').trim() || undefined
      // Parse result from log
      const resultIdx = content.indexOf('## Result\n')
      const result = resultIdx >= 0 ? content.slice(resultIdx + 10).trim() : undefined
      return c.json({ sessionId, result, fromLog: true })
    } catch {
      return c.json({ sessionId: entry?.sessionId, result: entry?.result })
    }
  }

  return c.json({ sessionId: entry?.sessionId, result: entry?.result })
})

// ── POST /api/context/start — launch Claude Code for context onboarding ──

app.post('/api/context/start', async (c) => {
  const body = await c.req.json<{
    request: string
    preset?: string
    editable?: boolean
    actionTarget?: ActionTarget
    actionInstructions?: string
    history?: Array<{ role: 'user' | 'agent'; text: string }>
    resume?: string
  }>()

  const requestText = body.request?.trim()
  if (!requestText) {
    return c.json({ error: 'request is required' }, 400)
  }

  const editable = body.editable ?? true
  const requestedTarget = body.actionTarget ?? {}
  const requestedActionInstructions = body.actionInstructions?.trim() ?? ''

  const registry = await readContextRegistry()
  const contextLines = registry.map(describeContextSource)
  const actionLines = (await readActionRegistry()).map(describeAction)
  const presetHint = body.preset ? CONTEXT_PRESET_HINTS[body.preset] : ''
  const promptParts = [
    'Onboard new business context into agent-os.',
    body.preset ? `Preset: ${body.preset}` : '',
    body.preset && presetHint ? `Preset guidance: ${presetHint}` : '',
    `User request: ${requestText}`,
    `Editable by agents: ${editable ? 'yes' : 'no'}`,
    editable ? `Requested writable target: kind=${requestedTarget.kind ?? 'filesystem'}, location=${requestedTarget.location?.trim() || '(not provided)'}, cwd=${requestedTarget.cwd?.trim() || '(not provided)'}` : 'Requested writable target: none',
    editable ? `Action instructions: ${requestedActionInstructions || '(none provided)'}` : 'Action instructions: none',
    '',
    'Requirements:',
    '- Start executing immediately; do not ask follow-up questions.',
    '- Make reasonable assumptions when safe.',
    '- If credentials or manual setup are required, scaffold the source as incomplete and write requirements.md.',
    '- Context answers "what is this?" and is descriptive/read-first metadata.',
    '- Action answers "can agents change it, where, and under what instructions?"',
    '- Do not treat a machine-local filesystem path as the identity of a repository or other durable source.',
    '- For repository sources, require a canonical git remote URL (https://... or git@...). Clone only from that remote; never copy a local checkout into context/.',
    '- If the request only provides a local path or otherwise lacks a canonical remote/source URL, scaffold README.md, source.yml, and requirements.md, then set status to needs_setup or draft.',
    '- Create one or more source folders under context/<source-id>/ when onboarding new sources.',
    '- Each source should include README.md and source.yml.',
    '- Update context/registry.yml with additive entries that preserve existing sources.',
    '- If editable=yes, also create exactly one linked default action under actions/<action-id>/ with README.md and action.yml, and register it in actions/registry.yml.',
    '- If editable=no, do not create an action.',
    '- If editable=yes but the writable target is incomplete, create the action with status needs_setup instead of inventing a fake target.',
    '- Never convert read context into an implicit write target.',
    '- Never create a copied writable surrogate automatically.',
    '- Never store secrets in repo-tracked files.',
    '- Prefer canonical remotes and durable fetched artifacts over machine-specific path references.',
    '',
    ...(contextLines.length ? [
      'Existing context registry:',
      ...contextLines,
      '',
    ] : []),
    ...(actionLines.length ? [
      'Existing action registry:',
      ...actionLines,
      '',
    ] : []),
  ]

  let prompt: string
  if (body.history && body.history.length > 0) {
    const thread = body.history
      .map(m => `[${m.role === 'user' ? 'User' : 'Agent'}]: ${m.text}`)
      .join('\n\n')
    prompt = `${promptParts.join('\n')}\nConversation so far:\n${thread}\n\n[User]: ${requestText}`
  } else {
    prompt = promptParts.join('\n')
  }

  const systemPrompt = [
    'You are the Context Creator for agent-os.',
    `Your working directory is: ${OPS_DIR}`,
    `The context registry is: ${CONTEXT_REGISTRY_PATH}`,
    `Write context source folders under: ${CONTEXT_SOURCES_DIR}`,
    `The actions registry is: ${ACTIONS_REGISTRY_PATH}`,
    `Write action folders under: ${ACTIONS_DIR}`,
    `Write onboarding logs under: ${CONTEXT_LOGS_DIR}`,
    '',
    'CORE PRINCIPLE: Canonical source identity matters more than convenience.',
    'All context manifests, action manifests, and onboarding docs must live inside this ops directory, but do not copy arbitrary local filesystem paths into context/ just to make them writable.',
    'Context is the read model. Actions are the write/execute model.',
    '- Repositories: only use explicit canonical git remotes (https://... or git@...). Clone into context/<id>/repo/ only when such a remote is provided.',
    '- Websites: fetch pages into context/<id>/ as markdown files',
    '- Files/folders: fetch or download from canonical URLs when possible. If they only exist on a local machine path, scaffold documentation and requirements instead of copying them.',
    '- Databases/APIs/email: scaffold docs and requirements under context/<id>/',
    '',
    'For git clones, create a .gitignore inside context/<id>/ that ignores the repo/ directory.',
    'Record the origin URL in source.yml so the clone can be refreshed later.',
    'When editable context is requested, create one linked default action with explicit target metadata and instructions.',
    'An action must answer: what can agents change, where is the original writable target, and how should agents work with it.',
    'Never infer edit permission from context alone.',
    'Never set a copied workspace as canonical unless the action explicitly says to work on a copy.',
    '',
    'Do not reference local machine paths outside this ops directory as source identity. Do not use ../ paths.',
    'Do not ask follow-up questions — make reasonable assumptions and proceed.',
    'Do not persist secrets, credentials, tokens, or passwords in any repo-tracked file.',
    'If setup is incomplete, record missing requirements in requirements.md and set status to needs_setup.',
    '',
    'Allowed type values for registry.yml: website, repository, folder, file, database, api, email, mcp, custom.',
    'Each context source needs: a stable id, README.md, source.yml, and any local artifacts.',
    'Each action needs: a stable id, README.md, action.yml, target metadata, and instructions.',
  ].join('\n')

  await mkdir(CONTEXT_SOURCES_DIR, { recursive: true })
  await mkdir(ACTIONS_DIR, { recursive: true })
  await mkdir(CONTEXT_LOGS_DIR, { recursive: true })

  return streamAgentExecution(c, {
    prompt,
    cwd: OPS_DIR,
    systemPrompt,
    resume: body.resume,
  })
})

// ── POST /api/scheduler/start — task planning agent ─────

app.post('/api/scheduler/start', async (c) => {
  const body = await c.req.json<{
    thoughts: string
    history?: Array<{ role: 'user' | 'agent'; text: string }>
    resume?: string
  }>()

  const thoughtsText = body.thoughts?.trim()
  if (!thoughtsText) return c.json({ error: 'thoughts is required' }, 400)

  const contextRegistry = await readContextRegistry()
  const contextLines = contextRegistry.map(describeContextSource)

  let existingTasksText = 'No tasks yet.'
  let nextId = 'TASK-001'
  try {
    const raw = await readFile(join(OPS_DIR, 'list.yml'), 'utf-8')
    const parsed = parseYaml(raw) as { list?: Array<Record<string, unknown>> }
    const existing = parsed?.list ?? []
    if (existing.length > 0) {
      existingTasksText = existing.map(t =>
        `- ${t.id}: ${t.title} [${t.status}]${t.priority ? ` (${t.priority})` : ''}${t.description ? ` — ${String(t.description).slice(0, 100)}` : ''}`
      ).join('\n')
    }
    const nums = existing
      .map(t => parseInt(String(t.id ?? '').replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n))
    const max = nums.length ? Math.max(...nums) : 0
    nextId = `TASK-${String(max + 1).padStart(3, '0')}`
  } catch { /* no queue yet */ }

  const contextSummary = contextLines.length
    ? `Available context sources:\n${contextLines.join('\n')}`
    : 'No context sources configured yet.'

  const tasksSummary = `Existing tasks (avoid duplicating):\n${existingTasksText}`

  const systemPrompt = [
    'You are the Task Planner for agent-os, a file-based business operating system.',
    `Your working directory is: ${OPS_DIR}`,
    `Tasks file: ${join(OPS_DIR, 'list.yml')}`,
    '',
    'YOUR JOB: Translate user thoughts into well-described, executable tasks in list.yml.',
    '',
    'TASK FORMAT — each task is a YAML block under the "list:" key:',
    '  - id: TASK-NNN',
    '    title: Short action-oriented title (start with a verb)',
    '    status: ready',
    '    context: []',
    '    actions: []',
    '    depends_on: []',
    '    priority: critical | high | medium | low',
    '    clarification_needed: true   # only when intent is genuinely ambiguous — see below',
    '    description: >',
    '      Detailed description. Must include:',
    '      - What specifically needs to be done',
    '      - What "done" looks like (acceptance criteria)',
    '      - Which context source ids are involved',
    '      - Which action ids are required, or [] if none are known yet',
    '      - Any constraints or things to avoid',
    '',
    'CLARIFICATION RULE — this is the most important rule:',
    'When the user\'s intent is ambiguous — especially for destructive or irreversible actions',
    '(removing features, deleting data, renaming things) — do NOT guess and over-specify.',
    'Instead, create a single task with:',
    '  - title starting with "CLARIFY:"',
    '  - clarification_needed: true',
    '  - description containing your specific questions and the options you see',
    '  - status: ready',
    '  - priority: high',
    'The human will answer the questions by editing the task description, then run the agent on it.',
    '',
    'When to create a CLARIFY task (prefer action, but clarify when genuinely needed):',
    '- The request targets something that could mean multiple things (e.g. "remove the scheduler" when two exist)',
    '- The action is destructive or hard to reverse and the exact scope is unclear',
    '- Key information is missing and a wrong assumption would cause significant rework',
    '',
    'When NOT to clarify (just act):',
    '- The request is clear and unambiguous',
    '- The worst case of a wrong assumption is minor and easily fixed',
    '- You can infer intent confidently from context',
    '',
    'GENERAL RULES:',
    '- Write tasks that are immediately executable — a future agent should be able to read the task and act without asking questions',
    '- Prefer a few well-scoped tasks over many vague ones',
    '- Do not duplicate existing tasks',
    '- Do not remove or modify existing tasks',
    '- Append new tasks at the end of list.yml',
    `- Next available task ID: ${nextId}`,
  ].join('\n')

  let prompt: string
  if (body.history && body.history.length > 0) {
    const thread = body.history
      .map(m => `[${m.role === 'user' ? 'User' : 'Planner'}]: ${m.text}`)
      .join('\n\n')
    prompt = `${contextSummary}\n\n${tasksSummary}\n\nConversation so far:\n${thread}\n\n[User]: ${thoughtsText}`
  } else {
    prompt = `${contextSummary}\n\n${tasksSummary}\n\nUser's goals and thoughts:\n${thoughtsText}`
  }

  return streamAgentExecution(c, {
    prompt,
    cwd: OPS_DIR,
    systemPrompt,
    resume: body.resume,
    model: 'claude-haiku-4-5-20251001',
  })
})

// ── POST /api/tasks — create a new task ─────────────────

app.post('/api/tasks', async (c) => {
  const body = await c.req.json<{
    title: string
    description?: string
    owner?: string
    priority?: string
    context?: string[]
    actions?: string[]
    depends_on?: string[]
  }>()
  if (!body.title?.trim()) return c.json({ error: 'title required' }, 400)

  // Determine next task ID
  const existing = await readTaskQueue()
  let nextId = 'TASK-001'
  const nums = existing
    .map(t => parseInt(String(t.id ?? '').replace(/\D/g, ''), 10))
    .filter(n => !isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  nextId = `TASK-${String(max + 1).padStart(3, '0')}`

  try {
    const task = normalizeTask({
      id: nextId,
      title: body.title.trim(),
      status: 'ready',
      owner: body.owner,
      priority: body.priority?.trim() || 'medium',
      description: body.description?.trim() || undefined,
      context: body.context ?? [],
      actions: body.actions ?? [],
      depends_on: body.depends_on ?? [],
    })
    await writeTaskQueue([...existing, task])
    return c.json({ ok: true, id: nextId })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// ── PATCH /api/tasks/:id — update task status ───────────

app.patch('/api/tasks/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ status: string }>()
  if (!body.status) return c.json({ error: 'status required' }, 400)
  try {
    await updateTaskStatus(id, body.status)
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// ── DELETE /api/tasks/:id — permanently remove a task ───

app.delete('/api/tasks/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const tasks = await readTaskQueue()
    const exists = tasks.some(t => t.id === id)
    if (!exists) return c.json({ error: 'Task not found' }, 404)
    await writeTaskQueue(tasks.filter(t => t.id !== id))
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// ── GET /api/health ─────────────────────────────────────

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', opsDir: OPS_DIR, provider: provider.name })
})

// ── Start ───────────────────────────────────────────────

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(``)
  console.log(`  agent-os v0.1.0`)
  console.log(`  ─────────────────────`)
  console.log(`  http://localhost:${info.port}`)
  console.log(`  ops: ${OPS_DIR}`)
  console.log(``)
})

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
