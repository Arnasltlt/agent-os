/**
 * Agent Provider — the only abstraction in the system.
 *
 * Any AI agent (Claude Code, Codex, Ollama) implements this.
 * The server streams AgentMessages to the browser. That's it.
 */

export interface AgentMessage {
  type: 'system' | 'session' | 'result' | 'tool' | 'error'
  text?: string
  data?: Record<string, unknown>
}

export interface AgentProvider {
  name: string

  execute(params: {
    prompt: string
    cwd: string
    systemPrompt?: string
    maxTurns?: number
    resume?: string
    additionalDirectories?: string[]
    settings?: Record<string, unknown> | string
    sandbox?: Record<string, unknown>
  }): AsyncIterable<AgentMessage>

  abort(sessionId: string): Promise<void>
}
