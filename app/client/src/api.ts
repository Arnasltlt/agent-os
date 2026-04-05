/**
 * API client — talks to the agent-os server.
 * Vite proxies /api → localhost:3001 in dev.
 */

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Board ────────────────────────────────────────────

export interface QueueTask {
  id: string
  title: string
  status: string
  priority?: string
  why?: string
  description?: string
  context?: string[]
  actions?: string[]
  depends_on?: string[]
  clarification_needed?: boolean
}

export interface BoardData {
  tasks: QueueTask[]
  contextFiles: string[]
  name?: string
  opsDir?: string
  projectRoot?: string
}

export function fetchBoard(): Promise<BoardData> {
  return request<BoardData>('/api/board')
}

// ── Context Registry ─────────────────────────────────

export type ContextType =
  | 'website'
  | 'repository'
  | 'folder'
  | 'file'
  | 'database'
  | 'api'
  | 'email'
  | 'mcp'
  | 'custom'

export type ContextPreset = ContextType

export type ContextStatus = 'active' | 'inactive' | 'needs_setup' | 'error' | 'draft'

export type ActionStatus = 'active' | 'inactive' | 'needs_setup' | 'draft'

export interface ActionTarget {
  kind: string
  location: string
  cwd?: string
}

export interface ContextSource {
  id: string
  name: string
  type: ContextType | 'folder' | 'database' | 'api' | 'email' | 'file'
  path?: string
  provider?: string
  description?: string
  config?: Record<string, unknown>
  status?: ContextStatus
  origin?: string | Record<string, unknown>
  runtime?: Record<string, unknown>
  artifacts?: string[]
  metadata?: Record<string, unknown>
  requirements?: string[] | Record<string, unknown>
  editable?: boolean
  default_action_id?: string
}

export function fetchContext(): Promise<{ context: ContextSource[] }> {
  return request<{ context: ContextSource[] }>('/api/context')
}

export function addContext(source: ContextSource): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/context', {
    method: 'POST',
    body: JSON.stringify(source),
  })
}

export function updateContext(id: string, patch: Partial<ContextSource>): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/context/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function deleteContext(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/context/${id}`, { method: 'DELETE' })
}

export interface Action {
  id: string
  name: string
  status?: ActionStatus
  path?: string
  context_id?: string
  auto_created?: boolean
  instructions?: string
  target?: ActionTarget
}

export function fetchActions(): Promise<{ actions: Action[] }> {
  return request<{ actions: Action[] }>('/api/actions')
}

export function addAction(action: Partial<Action>): Promise<{ ok: boolean; id: string }> {
  return request<{ ok: boolean; id: string }>('/api/actions', {
    method: 'POST',
    body: JSON.stringify(action),
  })
}

export function updateAction(id: string, patch: Partial<Action>): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/actions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function deleteAction(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/actions/${id}`, { method: 'DELETE' })
}

// ── Files ────────────────────────────────────────────

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export function fetchFiles(): Promise<{ tree: FileNode[] }> {
  return request<{ tree: FileNode[] }>('/api/files')
}

export function fetchFile(path: string): Promise<{ path: string; content: string }> {
  return request<{ path: string; content: string }>(`/api/files/${path}`)
}

export function createTask(task: {
  title: string
  description?: string
  owner?: string
  priority?: string
  context?: string[]
  actions?: string[]
  depends_on?: string[]
}): Promise<{ ok: boolean; id: string }> {
  return request<{ ok: boolean; id: string }>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  })
}

export function resetTask(taskId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ready' }),
  })
}

export function deleteTask(taskId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/tasks/${taskId}`, { method: 'DELETE' })
}

export function fetchTaskRun(taskId: string): Promise<{ sessionId?: string; result?: string }> {
  return request<{ sessionId?: string; result?: string }>(`/api/tasks/${taskId}/run`)
}

// ── Agent (SSE stream) ──────────────────────────────

export interface AgentMessage {
  type: 'system' | 'session' | 'result' | 'tool' | 'error'
  text?: string
  data?: Record<string, unknown>
}

/**
 * Start an agent run. Returns an EventSource-like interface
 * that streams messages as they arrive.
 */
export interface ConversationEntry {
  role: 'user' | 'agent'
  text: string
}

function startStreamedRun(
  path: string,
  body: Record<string, unknown>,
  onMessage: (msg: AgentMessage) => void,
  onDone: () => void,
  onError: (err: string) => void,
): AbortController {
  const controller = new AbortController()

  fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      onError(`Server returned ${res.status}`)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let doneOnce = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Parse SSE frames
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      let currentEvent = ''
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          if (currentEvent === 'done') {
            if (!doneOnce) { doneOnce = true; onDone() }
          } else if (data) {
            try {
              const msg = JSON.parse(data) as AgentMessage
              if (currentEvent === 'error') {
                onError(msg.text ?? 'Unknown error')
              } else {
                onMessage(msg)
              }
            } catch {
              onMessage({ type: 'system', text: data })
            }
          }
          currentEvent = ''
        }
      }
    }

    if (!doneOnce) { onDone() }
  }).catch((err) => {
    if (!controller.signal.aborted) {
      onError(err instanceof Error ? err.message : String(err))
    }
  })

  return controller
}

export function startAgent(
  taskId: string,
  opts: { prompt?: string; comment?: string; history?: ConversationEntry[]; resume?: string },
  onMessage: (msg: AgentMessage) => void,
  onDone: () => void,
  onError: (err: string) => void,
): AbortController {
  return startStreamedRun(
    '/api/agent/start',
    { taskId, prompt: opts.prompt, comment: opts.comment, history: opts.history, resume: opts.resume },
    onMessage,
    onDone,
    onError,
  )
}

export function startContextAgent(
  opts: {
    request: string
    preset?: ContextPreset
    editable?: boolean
    actionTarget?: ActionTarget
    actionInstructions?: string
    history?: ConversationEntry[]
    resume?: string
  },
  onMessage: (msg: AgentMessage) => void,
  onDone: () => void,
  onError: (err: string) => void,
): AbortController {
  return startStreamedRun(
    '/api/context/start',
    {
      request: opts.request,
      preset: opts.preset,
      editable: opts.editable,
      actionTarget: opts.actionTarget,
      actionInstructions: opts.actionInstructions,
      history: opts.history,
      resume: opts.resume,
    },
    onMessage,
    onDone,
    onError,
  )
}

export function startSchedulerAgent(
  opts: {
    thoughts: string
    history?: ConversationEntry[]
    resume?: string
  },
  onMessage: (msg: AgentMessage) => void,
  onDone: () => void,
  onError: (err: string) => void,
): AbortController {
  return startStreamedRun(
    '/api/scheduler/start',
    { thoughts: opts.thoughts, history: opts.history, resume: opts.resume },
    onMessage,
    onDone,
    onError,
  )
}

