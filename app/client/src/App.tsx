import { useState, useEffect, useRef, useCallback } from 'react'
import {
  addAction,
  createTask,
  deleteAction,
  deleteContext,
  deleteTask,
  fetchActions,
  fetchTaskRun,
  fetchBoard,
  fetchContext,
  fetchFile,
  fetchFiles,
  resetTask,
  startAgent,
  startContextAgent,
  startSchedulerAgent,
  updateAction,
  updateContext,
  type Action,
  type ActionStatus,
  type ActionTarget,
  type AgentMessage,
  type ContextPreset,
  type ContextSource,
  type ConversationEntry,
  type FileNode,
  type QueueTask,
} from './api'
import type { AgentLogEntry } from './types'
import './App.css'

const COLUMNS = [
  { key: 'ready', label: 'TO DO' },
  { key: 'in_progress', label: 'DOING' },
  { key: 'done', label: 'DONE' },
]

type Section = 'dashboard' | 'list' | 'context' | 'actions' | 'files' | 'setup'
const NAV_ITEMS: { key: Section; label: string }[] = [
  { key: 'dashboard', label: 'DASH' },
  { key: 'list', label: 'LIST' },
  { key: 'context', label: 'CTX' },
  { key: 'actions', label: 'ACT' },
  { key: 'files', label: 'FILES' },
  { key: 'setup', label: 'SETUP' },
]

const CONTEXT_PRESETS: ContextPreset[] = [
  'repository',
]

function columnFor(status: string) {
  if (status === 'in_progress') return 'in_progress'
  if (status === 'done') return 'done'
  return 'ready'
}

function parseIdList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function contextTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    website: 'WEB',
    repository: 'REPO',
    folder: 'FOLDER',
    file: 'FILE',
    database: 'DB',
    api: 'API',
    email: 'EMAIL',
    mcp: 'MCP',
    custom: 'CUSTOM',
  }
  return labels[type] ?? type.toUpperCase()
}

function contextStatusLabel(status?: string): string {
  const labels: Record<string, string> = {
    active: 'ACTIVE',
    inactive: 'INACTIVE',
    needs_setup: 'NEEDS SETUP',
    error: 'ERROR',
    draft: 'DRAFT',
  }
  return labels[status ?? ''] ?? (status ? status.toUpperCase() : 'ACTIVE')
}

function actionStatusLabel(status?: ActionStatus): string {
  const labels: Record<string, string> = {
    active: 'ACTIVE',
    inactive: 'INACTIVE',
    needs_setup: 'NEEDS SETUP',
    draft: 'DRAFT',
  }
  return labels[status ?? ''] ?? (status ? status.toUpperCase() : 'ACTIVE')
}

function targetSummary(target?: ActionTarget): string {
  if (!target) return 'No writable target configured'
  const location = target.location?.trim() || 'No writable target configured'
  return `${target.kind || 'filesystem'} • ${location}`
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^---+$/gm, '─────')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function messageText(msg: AgentMessage): string | null {
  if (msg.type === 'system') return null
  if (msg.type === 'result' && msg.text) return stripMarkdown(msg.text)
  if (msg.text) return stripMarkdown(msg.text)
  if (!msg.data) return null

  const data = msg.data as Record<string, unknown>

  // Assistant messages — extract text blocks and tool use summaries
  if (data.type === 'assistant' && Array.isArray(data.content)) {
    const parts: string[] = []
    for (const block of data.content as Array<Record<string, unknown>>) {
      if (block.type === 'text' && typeof block.text === 'string') {
        const cleaned = stripMarkdown(block.text).trim()
        if (cleaned) parts.push(cleaned)
      } else if (block.type === 'tool_use') {
        const name = String(block.name ?? '')
        // Show friendly tool descriptions instead of raw JSON
        const input = block.input as Record<string, unknown> | undefined
        if (name === 'Read') parts.push(`Reading ${input?.file_path ?? 'file'}`)
        else if (name === 'Write') parts.push(`Writing ${input?.file_path ?? 'file'}`)
        else if (name === 'Edit') parts.push(`Editing ${input?.file_path ?? 'file'}`)
        else if (name === 'Bash') parts.push(`Running: ${String(input?.command ?? '').slice(0, 80)}`)
        else if (name === 'Glob') parts.push(`Searching for ${input?.pattern ?? 'files'}`)
        else if (name === 'Grep') parts.push(`Searching for "${input?.pattern ?? ''}"`)
        else if (name) parts.push(`Using ${name}`)
      }
    }
    return parts.length ? parts.join('\n') : null
  }

  // Tool results — skip, they're noisy internals
  if (data.type === 'tool_result') return null

  // Skip anything else that looks like internal SDK chatter
  return null
}

function isRelativeOpsPath(path?: string): path is string {
  return Boolean(path && !path.startsWith('/'))
}

function originLabel(origin: ContextSource['origin']): string | null {
  if (!origin) return null
  if (typeof origin === 'string') return origin
  if (typeof origin === 'object') {
    const parts = ['url', 'path', 'provider', 'value', 'kind']
      .map(key => origin[key])
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
    if (parts.length > 0) return parts.join(' • ')
  }
  return null
}

function summarizeContextSource(source: ContextSource): string {
  const lines = [
    `Name: ${source.name}`,
    `Type: ${source.type}`,
    `Status: ${source.status ?? 'active'}`,
  ]

  if (source.description) lines.push(`Description: ${source.description}`)
  if (source.path) lines.push(`Path: ${source.path}`)

  const origin = originLabel(source.origin)
  if (origin) lines.push(`Origin: ${origin}`)

  if (source.artifacts?.length) {
    lines.push('')
    lines.push('Artifacts:')
    for (const artifact of source.artifacts) lines.push(`- ${artifact}`)
  }

  if (source.runtime) {
    lines.push('')
    lines.push('Runtime:')
    lines.push(JSON.stringify(source.runtime, null, 2))
  }

  if (source.metadata) {
    lines.push('')
    lines.push('Metadata:')
    lines.push(JSON.stringify(source.metadata, null, 2))
  }

  return lines.join('\n')
}

async function previewContextSource(source: ContextSource): Promise<{ name: string; content: string }> {
  const candidates: string[] = []

  if (isRelativeOpsPath(source.path)) {
    if (source.path.startsWith('context/')) {
      candidates.push(`${source.path}/README.md`, `${source.path}/requirements.md`, `${source.path}/source.yml`)
    }
    candidates.push(source.path)
  }

  for (const candidate of candidates) {
    try {
      const { content } = await fetchFile(candidate)
      return { name: source.name, content }
    } catch {
      continue
    }
  }

  return { name: source.name, content: summarizeContextSource(source) }
}

function summarizeAction(action: Action, contextName?: string): string {
  const lines = [
    `Name: ${action.name}`,
    `Status: ${action.status ?? 'active'}`,
    `Type: ${action.auto_created ? 'Auto-created default action' : 'Manual action'}`,
  ]

  if (contextName) lines.push(`Linked context: ${contextName}`)
  if (action.target) {
    lines.push(`Target kind: ${action.target.kind}`)
    lines.push(`Target location: ${action.target.location || '(not configured)'}`)
    if (action.target.cwd) lines.push(`Target cwd: ${action.target.cwd}`)
  }
  if (action.instructions) lines.push(`Instructions: ${action.instructions}`)

  return lines.join('\n')
}

async function previewAction(action: Action, contextName?: string): Promise<{ name: string; content: string }> {
  const candidates = action.path
    ? [`${action.path}/README.md`, `${action.path}/action.yml`]
    : []

  for (const candidate of candidates) {
    try {
      const { content } = await fetchFile(candidate)
      return { name: action.name, content }
    } catch {
      continue
    }
  }

  return { name: action.name, content: summarizeAction(action, contextName) }
}

function FileTreeNode({
  node,
  depth,
  expandedDirs,
  onToggle,
  onFileClick,
}: {
  node: FileNode
  depth: number
  expandedDirs: Set<string>
  onToggle: (path: string) => void
  onFileClick: (path: string, name: string) => void
}) {
  const isDir = node.type === 'directory'
  const isExpanded = expandedDirs.has(node.path)

  return (
    <>
      <div
        className={`ftree-node ${isDir ? 'ftree-dir' : 'ftree-file'}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => isDir ? onToggle(node.path) : onFileClick(node.path, node.name)}
      >
        <span className="ftree-icon">{isDir ? (isExpanded ? '\u25BE' : '\u25B8') : '\u2500'}</span>
        <span className="ftree-name">{node.name}</span>
      </div>
      {isDir && isExpanded && node.children?.map(child => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          expandedDirs={expandedDirs}
          onToggle={onToggle}
          onFileClick={onFileClick}
        />
      ))}
    </>
  )
}

function App() {
  const [tasks, setTasks] = useState<QueueTask[]>([])
  const [contextFiles, setContextFiles] = useState<string[]>([])
  const [contextSources, setContextSources] = useState<ContextSource[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [projectName, setProjectName] = useState('My Business')
  const [opsDir, setOpsDir] = useState('')
  const [selected, setSelected] = useState<QueueTask | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contextPreview, setContextPreview] = useState<{ name: string; content: string } | null>(null)
  const [newTask, setNewTask] = useState<{
    title: string
    description: string
    priority: string
    contextRefs: string
    actionRefs: string
    dependsOnRefs: string
  } | null>(null)
  const [creating, setCreating] = useState(false)


  // Navigation
  const [activeSection, setActiveSection] = useState<Section>('list')

  // File explorer (Under the Hood)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('agent-os-theme')
    return (stored === 'dark' || stored === 'light') ? stored : 'dark'
  })

  const [agentRunning, setAgentRunning] = useState<string | null>(null)
  const [agentLogs, setAgentLogs] = useState<Record<string, AgentLogEntry[]>>({})
  const taskLogEndRef = useRef<HTMLDivElement>(null)
  const taskAbortRef = useRef<AbortController | null>(null)
  const [conversations, setConversations] = useState<Record<string, ConversationEntry[]>>({})
  const [sessionIds, setSessionIds] = useState<Record<string, string>>({})
  const [turnLimitTasks, setTurnLimitTasks] = useState<Set<string>>(new Set())
  const [reply, setReply] = useState('')

  const [showContextAgent, setShowContextAgent] = useState(false)
  const [contextPreset, setContextPreset] = useState<ContextPreset>('repository')
  const [contextRequest, setContextRequest] = useState('')
  const [contextEditable, setContextEditable] = useState(true)
  const [contextActionTargetKind, setContextActionTargetKind] = useState('filesystem')
  const [contextActionTargetLocation, setContextActionTargetLocation] = useState('')
  const [contextActionTargetCwd, setContextActionTargetCwd] = useState('')
  const [contextActionInstructions, setContextActionInstructions] = useState('')
  const [contextAgentRunning, setContextAgentRunning] = useState(false)
  const [contextAgentLogs, setContextAgentLogs] = useState<AgentLogEntry[]>([])
  const [contextAgentSessionId, setContextAgentSessionId] = useState<string | null>(null)
  const [contextAgentResult, setContextAgentResult] = useState('')
  const contextLogEndRef = useRef<HTMLDivElement>(null)
  const contextAbortRef = useRef<AbortController | null>(null)

  // Scheduler
  const [schedulerThoughts, setSchedulerThoughts] = useState('')
  const [schedulerRunning, setSchedulerRunning] = useState(false)
  const [schedulerCurrentThought, setSchedulerCurrentThought] = useState('')
  const schedulerAbortRef = useRef<AbortController | null>(null)
  const [listSchedulerFocused, setListSchedulerFocused] = useState(false)

  const [editingContext, setEditingContext] = useState<ContextSource | null>(null)
  const [configEditable, setConfigEditable] = useState(false)
  const [configActionName, setConfigActionName] = useState('')
  const [configActionTargetKind, setConfigActionTargetKind] = useState('filesystem')
  const [configActionTargetLocation, setConfigActionTargetLocation] = useState('')
  const [configActionTargetCwd, setConfigActionTargetCwd] = useState('')
  const [configActionInstructions, setConfigActionInstructions] = useState('')
  const [savingContextConfig, setSavingContextConfig] = useState(false)

  const [editingAction, setEditingAction] = useState<Action | null>(null)
  const [actionFormName, setActionFormName] = useState('')
  const [actionFormContextId, setActionFormContextId] = useState('')
  const [actionFormStatus, setActionFormStatus] = useState<ActionStatus>('active')
  const [actionFormTargetKind, setActionFormTargetKind] = useState('filesystem')
  const [actionFormTargetLocation, setActionFormTargetLocation] = useState('')
  const [actionFormTargetCwd, setActionFormTargetCwd] = useState('')
  const [actionFormInstructions, setActionFormInstructions] = useState('')
  const [savingAction, setSavingAction] = useState(false)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('agent-os-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const resetContextAgentForm = useCallback(() => {
    setContextPreset('custom')
    setContextRequest('')
    setContextEditable(true)
    setContextActionTargetKind('filesystem')
    setContextActionTargetLocation('')
    setContextActionTargetCwd('')
    setContextActionInstructions('')
  }, [])

  const openActionEditor = useCallback((action?: Action | null) => {
    if (action) {
      setEditingAction(action)
      setActionFormName(action.name)
      setActionFormContextId(action.context_id ?? '')
      setActionFormStatus((action.status ?? 'active') as ActionStatus)
      setActionFormTargetKind(action.target?.kind ?? 'filesystem')
      setActionFormTargetLocation(action.target?.location ?? '')
      setActionFormTargetCwd(action.target?.cwd ?? '')
      setActionFormInstructions(action.instructions ?? '')
      return
    }

    setEditingAction({ id: '', name: '', status: 'active', auto_created: false })
    setActionFormName('')
    setActionFormContextId('')
    setActionFormStatus('active')
    setActionFormTargetKind('filesystem')
    setActionFormTargetLocation('')
    setActionFormTargetCwd('')
    setActionFormInstructions('')
  }, [])

  const refresh = useCallback(async () => {
    try {
      const data = await fetchBoard()
      setTasks(data.tasks)
      setContextFiles(data.contextFiles)
      if (data.name) setProjectName(data.name)
      if (data.opsDir) setOpsDir(data.opsDir)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshContext = useCallback(async () => {
    try {
      const { context } = await fetchContext()
      setContextSources(context)
    } catch {
      /* fall back to legacy file list */
    }
  }, [])

  const refreshActions = useCallback(async () => {
    try {
      const { actions: nextActions } = await fetchActions()
      setActions(nextActions)
    } catch {
      setActions([])
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { refreshContext() }, [refreshContext])
  useEffect(() => { refreshActions() }, [refreshActions])

  // When a task is opened, fetch last run info (session ID + result) from server
  useEffect(() => {
    if (!selected) return
    fetchTaskRun(selected.id).then(({ sessionId, result }) => {
      if (sessionId) setSessionIds(prev => prev[selected.id] ? prev : { ...prev, [selected.id]: sessionId })
      if (result && !conversations[selected.id]?.length) {
        setConversations(prev => prev[selected.id]?.length ? prev : {
          ...prev,
          [selected.id]: [{ role: 'agent', text: result }],
        })
      }
    }).catch(() => { /* no run log yet */ })
  }, [selected?.id])

  useEffect(() => {
    taskLogEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [agentLogs, selected?.id])

  useEffect(() => {
    contextLogEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [contextAgentLogs])

  useEffect(() => {
    if (selected) {
      const updated = tasks.find(task => task.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [tasks, selected])

  useEffect(() => {
    if (!agentRunning && !contextAgentRunning && !schedulerRunning) return
    const interval = setInterval(() => {
      refresh()
      refreshContext()
      refreshActions()
    }, 3000)
    return () => clearInterval(interval)
  }, [agentRunning, contextAgentRunning, refresh, refreshContext, refreshActions])

  useEffect(() => {
    const interval = setInterval(() => {
      refresh()
      refreshContext()
      refreshActions()
    }, 15000)
    return () => clearInterval(interval)
  }, [refresh, refreshContext, refreshActions])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (contextPreview) setContextPreview(null)
      else if (newTask) setNewTask(null)
      else if (editingAction) setEditingAction(null)
      else if (editingContext) setEditingContext(null)
      else if (showContextAgent) setShowContextAgent(false)
      else if (selected) setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contextPreview, newTask, editingAction, editingContext, selected, showContextAgent])

  // File explorer: fetch tree when section is opened
  useEffect(() => {
    if (activeSection !== 'files' || fileTree.length > 0) return
    fetchFiles().then(({ tree }) => setFileTree(tree)).catch(() => {})
  }, [activeSection, fileTree.length])

  const handleToggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleFileClick = async (path: string, name: string) => {
    try {
      const { content } = await fetchFile(path)
      setContextPreview({ name, content })
    } catch { /* silent */ }
  }

  const runTaskAgent = (task: QueueTask, userText: string, history: ConversationEntry[], resume?: string) => {
    setTasks(prev => prev.map(item => item.id === task.id ? { ...item, status: 'in_progress' } : item))
    setAgentRunning(task.id)
    setTurnLimitTasks(prev => { const next = new Set(prev); next.delete(task.id); return next })
    setAgentLogs(prev => ({ ...prev, [task.id]: [{ type: 'system', text: 'Agent started', timestamp: Date.now() }] }))

    const addLog = (entry: AgentLogEntry) =>
      setAgentLogs(prev => ({ ...prev, [task.id]: [...(prev[task.id] ?? []), entry] }))

    let resultText = ''

    const onMessage = (msg: AgentMessage) => {
      if (msg.type === 'session' && msg.text) {
        setSessionIds(prev => ({ ...prev, [task.id]: msg.text! }))
        return
      }
      if (msg.type === 'result' && (msg.data as Record<string, unknown>)?.hitTurnLimit) {
        setTurnLimitTasks(prev => new Set([...prev, task.id]))
      }
      const text = messageText(msg)
      if (!text) return
      addLog({ type: msg.type, text, timestamp: Date.now() })
      if (msg.type === 'result') resultText = text
    }

    const onDone = () => {
      setAgentRunning(null)
      addLog({ type: 'done', text: 'Agent finished', timestamp: Date.now() })
      const newHistory: ConversationEntry[] = [
        ...history,
        { role: 'user', text: userText },
        ...(resultText ? [{ role: 'agent' as const, text: resultText }] : []),
      ]
      setConversations(prev => ({ ...prev, [task.id]: newHistory }))
      refresh()
      refreshContext()
      refreshActions()
    }

    const onError = (err: string) => {
      addLog({ type: 'error', text: err, timestamp: Date.now() })
      setAgentRunning(null)
      refresh()
      refreshContext()
      refreshActions()
    }

    taskAbortRef.current = startAgent(
      task.id,
      { comment: userText || undefined, history: history.length ? history : undefined, resume },
      onMessage,
      onDone,
      onError,
    )
  }

  const handleStart = (task: QueueTask) => {
    const userText = comment
    setComment('')
    runTaskAgent(task, userText, [])
  }

  const handleReply = (task: QueueTask) => {
    if (!reply.trim()) return
    const userText = reply.trim()
    setReply('')
    const sessionId = sessionIds[task.id]
    if (sessionId) {
      runTaskAgent(task, userText, [], sessionId)
      return
    }
    runTaskAgent(task, userText, conversations[task.id] ?? [])
  }

  const handleAbortTask = () => {
    taskAbortRef.current?.abort()
    setAgentRunning(null)
  }

  const handleOpenAddContext = () => {
    if (!contextAgentRunning) {
      resetContextAgentForm()
      setContextAgentLogs([])
      setContextAgentResult('')
      setContextAgentSessionId(null)
    }
    setShowContextAgent(true)
  }

  const handleStartContextAgent = () => {
    const userText = contextRequest.trim()
    if (!userText || contextAgentRunning) return

    setShowContextAgent(true)
    setContextAgentRunning(true)
    setContextAgentSessionId(null)
    setContextAgentResult('')
    setContextAgentLogs([{ type: 'system', text: 'Context agent started', timestamp: Date.now() }])

    const addLog = (entry: AgentLogEntry) => {
      setContextAgentLogs(prev => [...prev, entry])
    }

    contextAbortRef.current = startContextAgent(
      {
        request: userText,
        preset: contextPreset,
        editable: contextEditable,
        actionTarget: contextEditable
          ? {
            kind: contextActionTargetKind,
            location: contextActionTargetLocation,
            ...(contextActionTargetCwd.trim() ? { cwd: contextActionTargetCwd.trim() } : {}),
          }
          : undefined,
        actionInstructions: contextEditable ? contextActionInstructions : undefined,
      },
      (msg) => {
        if (msg.type === 'session' && msg.text) {
          setContextAgentSessionId(msg.text)
          return
        }
        const text = messageText(msg)
        if (!text) return
        addLog({ type: msg.type, text, timestamp: Date.now() })
        if (msg.type === 'result') setContextAgentResult(text)
      },
      () => {
        setContextAgentRunning(false)
        addLog({ type: 'done', text: 'Context agent finished', timestamp: Date.now() })
        refreshContext()
        refreshActions()
      },
      (err) => {
        addLog({ type: 'error', text: err, timestamp: Date.now() })
        setContextAgentRunning(false)
        refreshContext()
        refreshActions()
      },
    )
  }

  const handleAbortContextAgent = () => {
    contextAbortRef.current?.abort()
    setContextAgentRunning(false)
  }

  const handleRunScheduler = () => {
    const text = schedulerThoughts.trim()
    if (!text || schedulerRunning) return
    const thought = text
    setSchedulerThoughts('')
    setSchedulerCurrentThought(thought)
    setSchedulerRunning(true)
    schedulerAbortRef.current = startSchedulerAgent(
      { thoughts: thought },
      (msg) => {
        const t = messageText(msg)
        if (!t) return
      },
      () => {
        setSchedulerRunning(false)
        setSchedulerCurrentThought('')
        refresh()
      },
      () => setSchedulerRunning(false),
    )
  }

  const handleAbortScheduler = () => {
    schedulerAbortRef.current?.abort()
    setSchedulerRunning(false)
  }

  const handleContextFileClick = async (filename: string) => {
    try {
      const { content } = await fetchFile(`context/${filename}`)
      setContextPreview({ name: filename, content })
    } catch {
      /* silent */
    }
  }

  const handleContextSourceClick = async (source: ContextSource) => {
    setContextPreview(await previewContextSource(source))
  }

  const handleDeleteContext = async (id: string) => {
    try {
      await deleteContext(id)
      await refreshContext()
      await refreshActions()
    } catch {
      /* silent */
    }
  }

  const defaultActionForContext = (source: ContextSource) => {
    if (source.default_action_id) {
      return actions.find(action => action.id === source.default_action_id) ?? null
    }
    if (source.editable) {
      return actions.find(action => action.context_id === source.id && action.auto_created) ?? null
    }
    return null
  }

  const actionsForContext = (sourceId: string) =>
    actions.filter(action => action.context_id === sourceId)

  const contextNameForAction = (action: Action) =>
    contextSources.find(source => source.id === action.context_id)?.name

  const handleActionClick = async (action: Action) => {
    setContextPreview(await previewAction(action, contextNameForAction(action)))
  }

  const handleOpenContextConfig = (source: ContextSource) => {
    const linkedAction = defaultActionForContext(source)
    setEditingContext(source)
    setConfigEditable(Boolean(source.editable))
    setConfigActionName(linkedAction?.name ?? `Edit ${source.name}`)
    setConfigActionTargetKind(linkedAction?.target?.kind ?? 'filesystem')
    setConfigActionTargetLocation(linkedAction?.target?.location ?? '')
    setConfigActionTargetCwd(linkedAction?.target?.cwd ?? '')
    setConfigActionInstructions(linkedAction?.instructions ?? '')
  }

  const handleSaveContextConfig = async () => {
    if (!editingContext || savingContextConfig) return

    setSavingContextConfig(true)
    try {
      const linkedAction = defaultActionForContext(editingContext)
      let actionId = editingContext.default_action_id

      if (configEditable) {
        const nextStatus: ActionStatus = configActionTargetLocation.trim() ? 'active' : 'needs_setup'
        const actionPayload = {
          name: configActionName.trim() || `Edit ${editingContext.name}`,
          context_id: editingContext.id,
          auto_created: true,
          status: nextStatus,
          instructions: configActionInstructions.trim(),
          target: {
            kind: configActionTargetKind,
            location: configActionTargetLocation.trim(),
            ...(configActionTargetCwd.trim() ? { cwd: configActionTargetCwd.trim() } : {}),
          },
        }

        if (linkedAction?.id) {
          await updateAction(linkedAction.id, actionPayload)
          actionId = linkedAction.id
        } else {
          const created = await addAction(actionPayload)
          actionId = created.id
        }
      } else if (linkedAction?.id) {
        await updateAction(linkedAction.id, { status: 'inactive' })
      }

      await updateContext(editingContext.id, {
        editable: configEditable,
        ...(actionId ? { default_action_id: actionId } : {}),
      })

      await refreshContext()
      await refreshActions()
      setEditingContext(null)
    } catch {
      /* silent */
    } finally {
      setSavingContextConfig(false)
    }
  }

  const handleSaveAction = async () => {
    if (!editingAction || savingAction || !actionFormName.trim()) return

    setSavingAction(true)
    try {
      const payload = {
        name: actionFormName.trim(),
        context_id: actionFormContextId || undefined,
        status: actionFormStatus,
        instructions: actionFormInstructions.trim(),
        ...(editingAction.auto_created ? { auto_created: true } : {}),
        target: {
          kind: actionFormTargetKind,
          location: actionFormTargetLocation.trim(),
          ...(actionFormTargetCwd.trim() ? { cwd: actionFormTargetCwd.trim() } : {}),
        },
      }

      if (editingAction.id) {
        await updateAction(editingAction.id, payload)
      } else {
        await addAction(payload)
      }

      await refreshActions()
      await refreshContext()
      setEditingAction(null)
    } catch {
      /* silent */
    } finally {
      setSavingAction(false)
    }
  }

  const handleDeleteAction = async (id: string) => {
    try {
      await deleteAction(id)
      await refreshActions()
      await refreshContext()
    } catch {
      /* silent */
    }
  }

  const handleReset = async (task: QueueTask) => {
    await resetTask(task.id)
    await refresh()
  }

  const handleDeleteTask = async (task: QueueTask) => {
    await deleteTask(task.id)
    setSelected(null)
    await refresh()
  }

  const handleCreateTask = async () => {
    if (!newTask || !newTask.title.trim() || creating) return
    setCreating(true)
    try {
      await createTask({
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        priority: newTask.priority || undefined,
        context: parseIdList(newTask.contextRefs),
        actions: parseIdList(newTask.actionRefs),
        depends_on: parseIdList(newTask.dependsOnRefs),
      })
      setNewTask(null)
      await refresh()
    } catch {
      /* silent */
    } finally {
      setCreating(false)
    }
  }


  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggingId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(col)
  }

  const handleDragLeave = () => setDragOverCol(null)

  const handleDrop = async (e: React.DragEvent, col: string) => {
    e.preventDefault()
    setDragOverCol(null)
    if (!draggingId) return
    const id = draggingId
    setDraggingId(null)
    setTasks(prev => prev.map(task => task.id === id ? { ...task, status: col } : task))
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: col }),
    }).catch(() => {
      /* silent */
    })
  }

  const tasksByCol = (col: string) => tasks.filter(task => columnFor(task.status) === col)

  if (loading) {
    return <div className="app"><div className="center-msg"><span className="label-lg">Loading...</span></div></div>
  }

  if (error) {
    return (
      <div className="app"><div className="center-msg">
        <span className="label-lg" style={{ color: 'var(--primary-red)' }}>Cannot connect to server</span>
        <span className="body-sm" style={{ color: 'var(--on-surface-dim)' }}>{error}</span>
        <button className="btn-ghost" onClick={refresh}>Retry</button>
      </div></div>
    )
  }

  const selectedLog = selected ? (agentLogs[selected.id] ?? []) : []
  const anyAgentActive = Boolean(agentRunning || contextAgentRunning || schedulerRunning)

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="header-logo">agent-os</span>
          <span className="header-sep">/</span>
          <span className="header-project">{projectName}</span>
        </div>
        <div className="header-right">
          {anyAgentActive && (
            <span className="header-status">
              <span className="status-dot active" />
              <span className="label-sm">AGENT ACTIVE</span>
            </span>
          )}
          <button
            className="btn-ghost theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              setActiveSection('list')
              setNewTask({
                title: '',
                description: '',
                priority: 'medium',
                contextRefs: '',
                actionRefs: '',
                dependsOnRefs: '',
              })
            }}
          >
            + New Task
          </button>
        </div>
      </header>

      <div className="layout">
        <nav className="nav-rail">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              className={`nav-item ${activeSection === item.key ? 'active' : ''}`}
              onClick={() => setActiveSection(item.key)}
            >
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="section-content">
          {activeSection === 'dashboard' && (
            <div className="section-placeholder">
              <span className="label-lg">DASHBOARD</span>
              <span className="body-md" style={{ color: 'var(--on-surface-dim)' }}>
                An on-demand operating view generated by agents to summarize business status, risks, blockers, and next moves.
              </span>
            </div>
          )}

          {activeSection === 'list' && (
            <div className="list-view-wrapper">
              <div className="list-scheduler-bar">
                {!(listSchedulerFocused || schedulerThoughts || schedulerRunning) ? (
                  <div className="list-scheduler-trigger" onClick={() => setListSchedulerFocused(true)}>
                    <span className="list-scheduler-ai-icon">✦</span>
                    <span className="list-scheduler-placeholder">Generate tasks…</span>
                    <span className="list-scheduler-ai-badge">AI</span>
                  </div>
                ) : schedulerRunning ? (
                  <div className="list-scheduler-running">
                    <span className="status-dot active" style={{ display: 'inline-block', flexShrink: 0 }} />
                    <span className="body-sm">Creating tasks…</span>
                    {schedulerCurrentThought && (
                      <span className="body-sm list-scheduler-running-thought">{schedulerCurrentThought}</span>
                    )}
                    <button className="btn-ghost" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={handleAbortScheduler}>Abort</button>
                  </div>
                ) : (
                  <div className="list-scheduler-expanded">
                    <span className="scheduler-prompt-sym" style={{ paddingBottom: 8 }}>›</span>
                    <textarea
                      className="scheduler-textarea list-scheduler-textarea"
                      placeholder="Describe what you want to build, fix, or accomplish…"
                      value={schedulerThoughts}
                      onChange={e => setSchedulerThoughts(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleRunScheduler() }
                        if (e.key === 'Escape') { setListSchedulerFocused(false); setSchedulerThoughts('') }
                      }}
                      onBlur={() => { if (!schedulerThoughts.trim()) setListSchedulerFocused(false) }}
                      autoFocus
                      disabled={schedulerRunning}
                      rows={1}
                    />
                    <button className="btn-primary scheduler-run-btn" onClick={handleRunScheduler} disabled={!schedulerThoughts.trim() || schedulerRunning}>Run</button>
                    <button className="btn-ghost" onClick={() => { setListSchedulerFocused(false); setSchedulerThoughts('') }}>Cancel</button>
                  </div>
                )}
              </div>
              <div className="list-main-area">
              <main className="board">
                <div className="board-columns">
                  {COLUMNS.map(col => (
                    <div
                      key={col.key}
                      className={`column ${dragOverCol === col.key ? 'drag-over' : ''}`}
                      onDragOver={e => handleDragOver(e, col.key)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, col.key)}
                    >
                      <div className="column-header">
                        <span className="label-lg">{col.label}</span>
                        <span className="label-sm column-count">{tasksByCol(col.key).length}</span>
                      </div>
                      <div className="column-cards">
                        {tasksByCol(col.key).map(task => (
                          <div
                            key={task.id}
                            className={`card ${selected?.id === task.id ? 'selected' : ''} ${draggingId === task.id ? 'dragging' : ''}`}
                            draggable
                            onDragStart={e => handleDragStart(e, task.id)}
                            onDragEnd={() => setDraggingId(null)}
                            onClick={() => setSelected(selected?.id === task.id ? null : task)}
                          >
                            <div className="card-top">
                              <span className="label-sm card-id">{task.id}</span>
                              {task.clarification_needed && (
                                <span className="label-sm" style={{ color: 'var(--primary-red)' }}>CLARIFY</span>
                              )}
                              {agentRunning === task.id && (
                                <span className="agent-working label-sm">WORKING</span>
                              )}
                            </div>
                            <h3 className="title-md card-title">{task.title}</h3>
                            {(task.priority || (task.context?.length ?? 0) > 0 || (task.actions?.length ?? 0) > 0) && (
                              <div className="card-meta">
                                {task.priority && (
                                  <span className={`label-sm priority-${task.priority}`}>
                                    {task.priority.toUpperCase()}
                                  </span>
                                )}
                                {(task.context?.length ?? 0) > 0 && (
                                  <span className="label-sm card-context-count">CTX {task.context?.length}</span>
                                )}
                                {(task.actions?.length ?? 0) > 0 && (
                                  <span className="label-sm card-action-count">ACT {task.actions?.length}</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </main>

              {selected && (
                <div className="detail-panel">
                  <div className="detail-body">
                    <div className="detail-header">
                      <span className="label-sm">{selected.id}</span>
                      <button className="detail-close" onClick={() => setSelected(null)}>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>&times;</span>
                      </button>
                    </div>
                    <h2 className="headline-md detail-title">{selected.title}</h2>

                    <div className="detail-fields">
                      <div className="detail-field">
                        <span className="label-sm detail-label">STATUS</span>
                        <span className="label-md">{selected.status.toUpperCase().replace('_', ' ')}</span>
                      </div>
                      {selected.priority && (
                        <div className="detail-field">
                          <span className="label-sm detail-label">PRIORITY</span>
                          <span className={`label-md priority-${selected.priority}`}>{selected.priority.toUpperCase()}</span>
                        </div>
                      )}
                      <div className="detail-field">
                        <span className="label-sm detail-label">CONTEXT</span>
                        <div className="detail-tags">
                          {(selected.context?.length ?? 0) > 0 ? (
                            selected.context!.map(ref => (
                              <span key={ref} className="label-sm detail-tag">{ref}</span>
                            ))
                          ) : (
                            <span className="label-sm detail-tag unconfigured-tag">none</span>
                          )}
                        </div>
                      </div>
                      <div className="detail-field">
                        <span className="label-sm detail-label">ACTIONS</span>
                        <div className="detail-tags">
                          {(selected.actions?.length ?? 0) > 0 ? (
                            selected.actions!.map(ref => (
                              <span key={ref} className="label-sm detail-tag">{ref}</span>
                            ))
                          ) : (
                            <span className="label-sm detail-tag unconfigured-tag">none</span>
                          )}
                        </div>
                      </div>
                      {(selected.depends_on?.length ?? 0) > 0 && (
                        <div className="detail-field">
                          <span className="label-sm detail-label">DEPENDS ON</span>
                          <div className="detail-tags">
                            {selected.depends_on!.map(ref => (
                              <span key={ref} className="label-sm detail-tag">{ref}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="detail-description">
                      <span className="label-sm detail-label">DESCRIPTION</span>
                      <p className="body-md" style={{ marginTop: 'var(--sp-2)', color: 'var(--on-surface-muted)', whiteSpace: 'pre-wrap' }}>
                        {selected.description ?? selected.why}
                      </p>
                    </div>

                    {(conversations[selected.id]?.length ?? 0) > 0 && (
                      <div className="conv-history">
                        <span className="label-sm detail-label">CONVERSATION</span>
                        <div className="conv-entries">
                          {conversations[selected.id].map((msg, i) => (
                            <div key={i} className={`conv-entry conv-${msg.role}`}>
                              <span className="conv-role">{msg.role === 'user' ? 'You' : 'Agent'}</span>
                              <span className="conv-text">{msg.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selected.status !== 'done' && agentRunning !== selected.id && !agentRunning &&
                      (conversations[selected.id]?.length ?? 0) === 0 && (
                      <div className="detail-comment">
                        <span className="label-sm detail-label">INSTRUCTIONS</span>
                        <textarea
                          className="comment-input"
                          placeholder="Optional instructions for the agent..."
                          value={comment}
                          onChange={e => setComment(e.target.value)}
                          rows={3}
                        />
                      </div>
                    )}

                    {selectedLog.length > 0 && (
                      <div className="agent-log">
                        <span className="label-sm detail-label">AGENT LOG</span>
                        <div className="agent-log-entries">
                          {selectedLog.map((entry, i) => (
                            <div key={i} className={`log-entry log-${entry.type}`}>
                              <span className="log-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                              <span className="log-text">{entry.text}</span>
                            </div>
                          ))}
                          <div ref={taskLogEndRef} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="detail-actions-bar">
                    {turnLimitTasks.has(selected.id) && agentRunning !== selected.id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', width: '100%', padding: 'var(--sp-2) 0' }}>
                        <span className="label-sm" style={{ color: 'var(--primary-red)' }}>⚠ Turn limit reached — task incomplete</span>
                        <button
                          className="btn-primary"
                          onClick={() => runTaskAgent(selected, 'Continue where you left off. Complete the task.', conversations[selected.id] ?? [], sessionIds[selected.id])}
                        >
                          Resume
                        </button>
                      </div>
                    )}
                    {(conversations[selected.id]?.length ?? 0) > 0 && agentRunning !== selected.id && !agentRunning && (
                      <div className="reply-bar">
                        <textarea
                          className="comment-input reply-input"
                          placeholder="Follow up with the agent..."
                          value={reply}
                          onChange={e => setReply(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(selected) }}
                          rows={2}
                        />
                        <div className="reply-actions">
                          <button className="btn-primary" onClick={() => handleReply(selected)} disabled={!reply.trim()}>
                            Send
                          </button>
                          <button className="btn-ghost" onClick={() => handleReset(selected)}>
                            Reset
                          </button>
                        </div>
                        {sessionIds[selected.id] && (
                          <button
                            className="btn-ghost session-continue"
                            onClick={() => navigator.clipboard.writeText(`cd "${opsDir}" && claude --resume ${sessionIds[selected.id]} --dangerously-skip-permissions`)}
                          >
                            continue in claude code
                          </button>
                        )}
                      </div>
                    )}

                    {(conversations[selected.id]?.length ?? 0) === 0 && selected.status !== 'done' && !agentRunning && (
                      <button className="btn-primary" onClick={() => handleStart(selected)}>
                        Start Agent
                      </button>
                    )}
                    {agentRunning === selected.id && (
                      <>
                        <span className="label-sm" style={{ color: 'var(--status-active)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                          <span className="status-dot active" /> Working...
                        </span>
                        {sessionIds[selected.id] && (
                          <button
                            className="btn-ghost session-continue"
                            title="Copy command to attach to this session in your terminal"
                            onClick={() => navigator.clipboard.writeText(`cd "${opsDir}" && claude --resume ${sessionIds[selected.id]} --dangerously-skip-permissions`)}
                          >
                            view session
                          </button>
                        )}
                        <button className="btn-ghost" onClick={handleAbortTask}>Abort</button>
                      </>
                    )}
                    {(conversations[selected.id]?.length ?? 0) === 0 && selected.status === 'done' && agentRunning !== selected.id && (
                      <button className="btn-ghost" onClick={() => handleReset(selected)}>
                        Reset to Ready
                      </button>
                    )}
                    {agentRunning !== selected.id && (
                      <button
                        className="btn-ghost"
                        style={{ color: 'var(--primary-red)', marginLeft: 'auto' }}
                        onClick={() => handleDeleteTask(selected)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
              </div>{/* list-main-area */}
            </div>
          )}

          {activeSection === 'context' && (
            <div className="context-section">
              <div className="section-header">
                <span className="label-lg">CONTEXT</span>
                <button className="btn-ghost" onClick={handleOpenAddContext}>+ Add Context</button>
              </div>
              <div className="context-grid">
                {contextAgentRunning && (
                  <div className="ctx-card ctx-item ctx-run-card" onClick={() => setShowContextAgent(true)}>
                    <div className="ctx-run-header">
                      <span className="context-type ctx-badge-custom">AGENT</span>
                      <span className="body-sm ctx-name">Context onboarding in progress</span>
                      <span className="context-type ctx-status ctx-status-active">LIVE</span>
                    </div>
                    <p className="body-sm ctx-desc">
                      {contextRequest || 'Open the context agent to review live progress.'}
                    </p>
                  </div>
                )}

                {contextSources.length > 0 ? (
                  contextSources.map(source => (
                    <div
                      key={source.id}
                      className="ctx-card ctx-item ctx-clickable"
                      onClick={() => handleContextSourceClick(source)}
                    >
                      {(() => {
                        const linkedAction = defaultActionForContext(source)
                        const relatedActions = actionsForContext(source.id)
                        return (
                          <>
                      <div className="ctx-item-row">
                        <span className={`context-type ctx-badge-${source.type}`}>{contextTypeLabel(source.type)}</span>
                        <span className="body-sm ctx-name">{source.name}</span>
                        <span className={`context-type ctx-status ctx-status-${source.status ?? 'active'}`}>
                          {contextStatusLabel(source.status)}
                        </span>
                        <span className={`context-type ctx-write-state ${(source.editable && linkedAction?.status !== 'inactive') ? 'ctx-write-enabled' : 'ctx-write-readonly'}`}>
                          {source.editable ? actionStatusLabel(linkedAction?.status as ActionStatus | undefined) : 'READ ONLY'}
                        </span>
                        <div className="ctx-actions">
                          <button
                            className="ctx-btn"
                            title="Configure"
                            onClick={e => {
                              e.stopPropagation()
                              handleOpenContextConfig(source)
                            }}
                          >
                            ≡
                          </button>
                          <button
                            className="ctx-btn ctx-btn-delete"
                            title="Remove"
                            onClick={e => {
                              e.stopPropagation()
                              handleDeleteContext(source.id)
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      {source.description && <p className="body-sm ctx-desc">{source.description}</p>}
                      {source.path && <p className="body-sm ctx-path">{source.path}</p>}
                      {!source.path && originLabel(source.origin) && (
                        <p className="body-sm ctx-path">{originLabel(source.origin)}</p>
                      )}
                      <p className="body-sm ctx-meta">
                        {source.editable
                          ? `${linkedAction?.name ?? 'Default action pending'} • ${targetSummary(linkedAction?.target)}`
                          : 'Read-only context'}
                        {relatedActions.length > 1 ? ` • ${relatedActions.length} actions` : ''}
                      </p>
                          </>
                        )
                      })()}
                    </div>
                  ))
                ) : contextFiles.length > 0 ? (
                  contextFiles.map(filename => (
                    <div
                      key={filename}
                      className="ctx-card ctx-item ctx-clickable"
                      onClick={() => handleContextFileClick(filename)}
                    >
                      <div className="ctx-item-row">
                        <span className="context-type ctx-badge-file">FILE</span>
                        <span className="body-sm ctx-name">{filename}</span>
                      </div>
                      <p className="body-sm ctx-path">{`context/${filename}`}</p>
                    </div>
                  ))
                ) : (
                  <div className="section-empty">
                    <span className="body-md">No context sources yet.</span>
                    <span className="body-sm">Describe a website, repo, inbox, or service and let the context agent onboard it.</span>
                    <button className="btn-primary" onClick={handleOpenAddContext}>+ Add Context</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'actions' && (
            <div className="context-section">
              <div className="section-header">
                <span className="label-lg">ACTIONS</span>
                <button className="btn-ghost" onClick={() => openActionEditor(null)}>+ Add Action</button>
              </div>
              <div className="context-grid">
                {actions.length > 0 ? (
                  actions.map(action => (
                    <div
                      key={action.id}
                      className="ctx-card ctx-item ctx-clickable"
                      onClick={() => handleActionClick(action)}
                    >
                      <div className="ctx-item-row">
                        <span className="context-type ctx-badge-custom">{action.auto_created ? 'AUTO' : 'MANUAL'}</span>
                        <span className="body-sm ctx-name">{action.name}</span>
                        <span className={`context-type ctx-status ctx-status-${action.status ?? 'active'}`}>
                          {actionStatusLabel(action.status as ActionStatus | undefined)}
                        </span>
                        <div className="ctx-actions" style={{ opacity: 1 }}>
                          <button
                            className="ctx-btn"
                            title="Edit action"
                            onClick={e => {
                              e.stopPropagation()
                              openActionEditor(action)
                            }}
                          >
                            ≡
                          </button>
                          <button
                            className="ctx-btn ctx-btn-delete"
                            title="Remove action"
                            onClick={e => {
                              e.stopPropagation()
                              handleDeleteAction(action.id)
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <p className="body-sm ctx-desc">
                        {contextNameForAction(action) ? `Linked to ${contextNameForAction(action)}` : 'No linked context'}
                      </p>
                      <p className="body-sm ctx-path">{targetSummary(action.target)}</p>
                      {action.instructions && <p className="body-sm ctx-meta">{action.instructions}</p>}
                    </div>
                  ))
                ) : (
                  <div className="section-empty">
                    <span className="body-md">No actions configured yet.</span>
                    <span className="body-sm">Actions define what agents may change and where they may change it.</span>
                    <button className="btn-primary" onClick={() => openActionEditor(null)}>+ Add Action</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'files' && (
            <div className="files-section">
              <div className="section-header">
                <span className="label-lg">UNDER THE HOOD</span>
              </div>
              <div className="files-tree-full">
                {fileTree.length > 0 ? (
                  fileTree.map(node => (
                    <FileTreeNode
                      key={node.path}
                      node={node}
                      depth={0}
                      expandedDirs={expandedDirs}
                      onToggle={handleToggleDir}
                      onFileClick={handleFileClick}
                    />
                  ))
                ) : (
                  <span className="body-sm" style={{ color: 'var(--on-surface-dim)' }}>Loading...</span>
                )}
              </div>
            </div>
          )}

          {activeSection === 'setup' && (
            <div className="section-placeholder">
              <span className="label-lg">SETUP</span>
              <span className="body-md" style={{ color: 'var(--on-surface-dim)' }}>
                Onboarding and first-time configuration. Coming soon.
              </span>
            </div>
          )}
        </div>
      </div>

      {contextPreview && (
        <div className="file-preview-overlay" onClick={() => setContextPreview(null)}>
          <div className="file-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="file-preview-header">
              <span className="label-md" style={{ fontFamily: 'var(--font-mono)' }}>{contextPreview.name}</span>
              <button className="detail-close" onClick={() => setContextPreview(null)}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>&times;</span>
              </button>
            </div>
            <pre className="file-preview-content">{contextPreview.content}</pre>
          </div>
        </div>
      )}

      {newTask && (
        <div className="file-preview-overlay" onClick={() => setNewTask(null)}>
          <div className="file-preview-modal new-task-modal" onClick={e => e.stopPropagation()}>
            <div className="file-preview-header">
              <span className="label-md">NEW TASK</span>
              <button className="detail-close" onClick={() => setNewTask(null)}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>&times;</span>
              </button>
            </div>
            <div className="new-task-body">
              <div className="new-task-field">
                <label className="label-sm detail-label">TITLE *</label>
                <input
                  className="new-task-input"
                  placeholder="What needs to be done?"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateTask() }}
                  autoFocus
                />
              </div>
              <div className="new-task-field">
                <label className="label-sm detail-label">DESCRIPTION</label>
                <textarea
                  className="new-task-input comment-input"
                  placeholder="What does done look like?"
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="new-task-field">
                <label className="label-sm detail-label">PRIORITY</label>
                <select
                  className="new-task-input new-task-select"
                  value={newTask.priority}
                  onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="new-task-field">
                <label className="label-sm detail-label">CONTEXT IDS</label>
                <input
                  className="new-task-input"
                  placeholder="company, product, engineering"
                  value={newTask.contextRefs}
                  onChange={e => setNewTask({ ...newTask, contextRefs: e.target.value })}
                />
                {contextSources.length > 0 && (
                  <span className="label-sm detail-label" style={{ marginTop: 'var(--sp-2)' }}>
                    Available: {contextSources.map(source => source.id).join(', ')}
                  </span>
                )}
              </div>
              <div className="new-task-field">
                <label className="label-sm detail-label">ACTION IDS</label>
                <input
                  className="new-task-input"
                  placeholder="edit-app"
                  value={newTask.actionRefs}
                  onChange={e => setNewTask({ ...newTask, actionRefs: e.target.value })}
                />
                {actions.length > 0 && (
                  <span className="label-sm detail-label" style={{ marginTop: 'var(--sp-2)' }}>
                    Available: {actions.map(action => action.id).join(', ')}
                  </span>
                )}
              </div>
              <div className="new-task-field">
                <label className="label-sm detail-label">DEPENDS ON</label>
                <input
                  className="new-task-input"
                  placeholder="TASK-001, TASK-002"
                  value={newTask.dependsOnRefs}
                  onChange={e => setNewTask({ ...newTask, dependsOnRefs: e.target.value })}
                />
              </div>
            </div>
            <div className="new-task-footer">
              <button className="btn-primary" onClick={handleCreateTask} disabled={!newTask.title.trim() || creating}>
                {creating ? 'Creating...' : 'Create Task'}
              </button>
              <button className="btn-ghost" onClick={() => setNewTask(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showContextAgent && (
        <div className="file-preview-overlay" onClick={() => !contextAgentRunning && setShowContextAgent(false)}>
          <div className="file-preview-modal new-task-modal ctx-agent-modal" onClick={e => e.stopPropagation()}>
            <div className="file-preview-header">
              <span className="label-md">ADD CONTEXT</span>
              <button className="detail-close" onClick={() => setShowContextAgent(false)}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>&times;</span>
              </button>
            </div>
            <div className="new-task-body">
              <div className="new-task-field">
                <label className="label-sm detail-label">PRESET</label>
                <div className="ctx-type-pills">
                  {CONTEXT_PRESETS.map(preset => (
                    <button
                      key={preset}
                      className={`ctx-type-pill ${contextPreset === preset ? 'active' : ''}`}
                      onClick={() => { setContextPreset(preset) }}
                    >
                      {contextTypeLabel(preset)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="new-task-field">
                <label className="label-sm detail-label">REQUEST</label>
                <textarea
                  className="comment-input ctx-agent-input"
                  placeholder={contextPreset === 'repository'
                    ? 'Describe the repository and include its canonical GitHub or git remote URL. Avoid local filesystem paths.'
                    : 'Describe the business context you want to add. Include canonical URLs, repo links, providers, and any non-secret details.'
                  }
                  value={contextRequest}
                  onChange={e => setContextRequest(e.target.value)}
                  rows={6}
                  autoFocus
                />
                <p className="body-sm ctx-agent-copy">
                  {contextPreset === 'repository'
                    ? 'Repository onboarding requires a canonical git remote. The agent will not copy a local checkout into this ops folder.'
                    : contextPreset === 'folder' || contextPreset === 'file'
                      ? 'Use a canonical URL or durable external reference when possible. If the source only exists on a local machine path, the agent will scaffold requirements instead of copying it.'
                      : 'The context agent starts immediately, makes reasonable assumptions, and writes missing setup requirements into docs instead of asking follow-up questions.'
                  }
                </p>
              </div>

              <div className="new-task-field">
                <label className="ctx-toggle-row">
                  <input
                    type="checkbox"
                    checked={contextEditable}
                    onChange={e => setContextEditable(e.target.checked)}
                  />
                  <span className="label-sm detail-label">CAN AGENTS EDIT THIS?</span>
                </label>
                <p className="body-sm ctx-agent-copy">
                  Context is read metadata. When this is enabled, onboarding also creates a linked action that points at the real writable target.
                </p>
              </div>

              {contextEditable && (
                <>
                  <div className="new-task-field">
                    <label className="label-sm detail-label">WRITABLE TARGET KIND</label>
                    <select
                      className="new-task-input new-task-select"
                      value={contextActionTargetKind}
                      onChange={e => setContextActionTargetKind(e.target.value)}
                    >
                      <option value="filesystem">Filesystem</option>
                      <option value="repository">Repository</option>
                      <option value="website">Website</option>
                      <option value="service">Service</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="new-task-field">
                    <label className="label-sm detail-label">WRITABLE TARGET LOCATION</label>
                    <input
                      className="new-task-input"
                      placeholder="Canonical repo URL, real filesystem path, or other explicit original target"
                      value={contextActionTargetLocation}
                      onChange={e => setContextActionTargetLocation(e.target.value)}
                    />
                  </div>

                  <div className="new-task-field">
                    <label className="label-sm detail-label">TARGET WORKING DIRECTORY (OPTIONAL)</label>
                    <input
                      className="new-task-input"
                      placeholder="Preferred cwd for the agent when using this action"
                      value={contextActionTargetCwd}
                      onChange={e => setContextActionTargetCwd(e.target.value)}
                    />
                  </div>

                  <div className="new-task-field">
                    <label className="label-sm detail-label">ACTION INSTRUCTIONS (OPTIONAL)</label>
                    <textarea
                      className="comment-input"
                      placeholder="Any instructions about how agents should edit this target"
                      value={contextActionInstructions}
                      onChange={e => setContextActionInstructions(e.target.value)}
                      rows={3}
                    />
                  </div>
                </>
              )}

              {contextAgentLogs.length > 0 && (
                <div className="agent-log">
                  <span className="label-sm detail-label">CONTEXT AGENT LOG</span>
                  <div className="agent-log-entries ctx-agent-log">
                    {contextAgentLogs.map((entry, i) => (
                      <div key={i} className={`log-entry log-${entry.type}`}>
                        <span className="log-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        <span className="log-text">{entry.text}</span>
                      </div>
                    ))}
                    <div ref={contextLogEndRef} />
                  </div>
                </div>
              )}

              {contextAgentResult && !contextAgentRunning && (
                <div className="ctx-agent-result">
                  <span className="label-sm detail-label">LAST RESULT</span>
                  <pre className="body-sm ctx-agent-result-text">{contextAgentResult}</pre>
                </div>
              )}
            </div>
            <div className="new-task-footer ctx-agent-footer">
              {!contextAgentRunning ? (
                <button className="btn-primary" onClick={handleStartContextAgent} disabled={!contextRequest.trim()}>
                  Start Context Agent
                </button>
              ) : (
                <>
                  <span className="label-sm ctx-agent-live">
                    <span className="status-dot active" /> Working...
                  </span>
                  <button className="btn-ghost" onClick={handleAbortContextAgent}>Abort</button>
                </>
              )}
              {contextAgentSessionId && !contextAgentRunning && (
                <button
                  className="btn-ghost session-continue"
                  onClick={() => navigator.clipboard.writeText(`cd "${opsDir}" && claude --resume ${contextAgentSessionId} --dangerously-skip-permissions`)}
                >
                  continue in claude code
                </button>
              )}
              <button className="btn-ghost" onClick={() => setShowContextAgent(false)}>
                {contextAgentRunning ? 'Hide' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingContext && (
        <div className="file-preview-overlay" onClick={() => !savingContextConfig && setEditingContext(null)}>
          <div className="file-preview-modal new-task-modal" onClick={e => e.stopPropagation()}>
            <div className="file-preview-header">
              <span className="label-md">CONFIGURE CONTEXT</span>
              <button className="detail-close" onClick={() => setEditingContext(null)}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>&times;</span>
              </button>
            </div>
            <div className="new-task-body">
              <div className="new-task-field">
                <label className="label-sm detail-label">CONTEXT</label>
                <div className="body-md">{editingContext.name}</div>
              </div>

              <div className="new-task-field">
                <label className="ctx-toggle-row">
                  <input
                    type="checkbox"
                    checked={configEditable}
                    onChange={e => setConfigEditable(e.target.checked)}
                  />
                  <span className="label-sm detail-label">CAN AGENTS EDIT THIS?</span>
                </label>
              </div>

              {configEditable && (
                <>
                  <div className="new-task-field">
                    <label className="label-sm detail-label">DEFAULT ACTION NAME</label>
                    <input
                      className="new-task-input"
                      value={configActionName}
                      onChange={e => setConfigActionName(e.target.value)}
                    />
                  </div>

                  <div className="new-task-field">
                    <label className="label-sm detail-label">WRITABLE TARGET KIND</label>
                    <select
                      className="new-task-input new-task-select"
                      value={configActionTargetKind}
                      onChange={e => setConfigActionTargetKind(e.target.value)}
                    >
                      <option value="filesystem">Filesystem</option>
                      <option value="repository">Repository</option>
                      <option value="website">Website</option>
                      <option value="service">Service</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="new-task-field">
                    <label className="label-sm detail-label">WRITABLE TARGET LOCATION</label>
                    <input
                      className="new-task-input"
                      value={configActionTargetLocation}
                      onChange={e => setConfigActionTargetLocation(e.target.value)}
                    />
                  </div>

                  <div className="new-task-field">
                    <label className="label-sm detail-label">TARGET WORKING DIRECTORY (OPTIONAL)</label>
                    <input
                      className="new-task-input"
                      value={configActionTargetCwd}
                      onChange={e => setConfigActionTargetCwd(e.target.value)}
                    />
                  </div>

                  <div className="new-task-field">
                    <label className="label-sm detail-label">ACTION INSTRUCTIONS</label>
                    <textarea
                      className="comment-input"
                      value={configActionInstructions}
                      onChange={e => setConfigActionInstructions(e.target.value)}
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="new-task-footer">
              <button className="btn-primary" onClick={handleSaveContextConfig} disabled={savingContextConfig}>
                {savingContextConfig ? 'Saving...' : 'Save'}
              </button>
              <button className="btn-ghost" onClick={() => setEditingContext(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editingAction && (
        <div className="file-preview-overlay" onClick={() => !savingAction && setEditingAction(null)}>
          <div className="file-preview-modal new-task-modal" onClick={e => e.stopPropagation()}>
            <div className="file-preview-header">
              <span className="label-md">{editingAction.id ? 'EDIT ACTION' : 'NEW ACTION'}</span>
              <button className="detail-close" onClick={() => setEditingAction(null)}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>&times;</span>
              </button>
            </div>
            <div className="new-task-body">
              <div className="new-task-field">
                <label className="label-sm detail-label">NAME *</label>
                <input
                  className="new-task-input"
                  value={actionFormName}
                  onChange={e => setActionFormName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="new-task-field">
                <label className="label-sm detail-label">LINKED CONTEXT</label>
                <select
                  className="new-task-input new-task-select"
                  value={actionFormContextId}
                  onChange={e => setActionFormContextId(e.target.value)}
                >
                  <option value="">None</option>
                  {contextSources.map(source => (
                    <option key={source.id} value={source.id}>{source.name}</option>
                  ))}
                </select>
              </div>

              <div className="new-task-field">
                <label className="label-sm detail-label">STATUS</label>
                <select
                  className="new-task-input new-task-select"
                  value={actionFormStatus}
                  onChange={e => setActionFormStatus(e.target.value as ActionStatus)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="needs_setup">Needs setup</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              <div className="new-task-field">
                <label className="label-sm detail-label">TARGET KIND</label>
                <select
                  className="new-task-input new-task-select"
                  value={actionFormTargetKind}
                  onChange={e => setActionFormTargetKind(e.target.value)}
                >
                  <option value="filesystem">Filesystem</option>
                  <option value="repository">Repository</option>
                  <option value="website">Website</option>
                  <option value="service">Service</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="new-task-field">
                <label className="label-sm detail-label">TARGET LOCATION</label>
                <input
                  className="new-task-input"
                  value={actionFormTargetLocation}
                  onChange={e => setActionFormTargetLocation(e.target.value)}
                />
              </div>

              <div className="new-task-field">
                <label className="label-sm detail-label">TARGET WORKING DIRECTORY (OPTIONAL)</label>
                <input
                  className="new-task-input"
                  value={actionFormTargetCwd}
                  onChange={e => setActionFormTargetCwd(e.target.value)}
                />
              </div>

              <div className="new-task-field">
                <label className="label-sm detail-label">INSTRUCTIONS</label>
                <textarea
                  className="comment-input"
                  value={actionFormInstructions}
                  onChange={e => setActionFormInstructions(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="new-task-footer">
              <button className="btn-primary" onClick={handleSaveAction} disabled={savingAction || !actionFormName.trim()}>
                {savingAction ? 'Saving...' : editingAction.id ? 'Save Action' : 'Create Action'}
              </button>
              <button className="btn-ghost" onClick={() => setEditingAction(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
