/**
 * Claude Code Provider
 *
 * Uses @anthropic-ai/claude-agent-sdk to run Claude Code.
 * The SDK uses the user's local Claude Code auth — no API keys needed here.
 *
 * SDK message types we care about:
 *   assistant          — LLM response with text blocks and tool_use blocks
 *   tool_use_summary   — clean one-line summary of what a tool did
 *   result             — final result with summary text, cost, duration
 *   system (init)      — session ID, tools, MCP servers
 *   tool_progress      — tool still running (elapsed time)
 *
 * Everything else (stream_event, user, system/status, etc.) is noise.
 */
import type { AgentProvider, AgentMessage } from './types.js';
export declare class ClaudeCodeProvider implements AgentProvider {
    name: string;
    execute(params: {
        prompt: string;
        cwd: string;
        systemPrompt?: string;
        maxTurns?: number;
        model?: string;
        resume?: string;
        additionalDirectories?: string[];
        settings?: Record<string, unknown> | string;
        sandbox?: Record<string, unknown>;
    }): AsyncIterable<AgentMessage>;
    abort(sessionId: string): Promise<void>;
}
