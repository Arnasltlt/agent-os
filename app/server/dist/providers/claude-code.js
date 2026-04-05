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
const activeSessions = new Map();
export class ClaudeCodeProvider {
    name = 'claude-code';
    async *execute(params) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query;
        try {
            const sdk = await import('@anthropic-ai/claude-agent-sdk');
            query = sdk.query;
        }
        catch {
            yield {
                type: 'error',
                text: '@anthropic-ai/claude-agent-sdk is not installed. Run: npm install @anthropic-ai/claude-agent-sdk',
            };
            return;
        }
        const controller = new AbortController();
        const internalId = `session-${Date.now()}`;
        activeSessions.set(internalId, controller);
        try {
            for await (const message of query({
                prompt: params.prompt,
                abortController: controller,
                options: {
                    cwd: params.cwd,
                    maxTurns: params.maxTurns ?? 100,
                    systemPrompt: params.systemPrompt,
                    permissionMode: 'acceptEdits',
                    ...(params.model ? { model: params.model } : {}),
                    ...(params.additionalDirectories?.length ? { additionalDirectories: params.additionalDirectories } : {}),
                    ...(params.settings ? { settings: params.settings } : {}),
                    ...(params.sandbox ? { sandbox: params.sandbox } : {}),
                    ...(params.resume ? { resume: params.resume } : {}),
                },
            })) {
                const msg = message;
                switch (msg.type) {
                    // ── Init: extract session ID ──
                    case 'system':
                        if (msg.subtype === 'init') {
                            yield {
                                type: 'session',
                                text: msg.session_id,
                                data: {
                                    session_id: msg.session_id,
                                    mcp_servers: msg.mcp_servers,
                                    tools: msg.tools,
                                },
                            };
                        }
                        // Skip all other system messages (status, compact_boundary, api_retry)
                        break;
                    // ── Tool use summary: the clean one-liner from the SDK ──
                    case 'tool_use_summary':
                        yield { type: 'tool', text: msg.summary };
                        break;
                    // ── Assistant message: extract text blocks ──
                    case 'assistant': {
                        const betaMsg = msg.message;
                        if (!betaMsg?.content)
                            break;
                        const textParts = [];
                        for (const block of betaMsg.content) {
                            if (block.type === 'text' && typeof block.text === 'string') {
                                textParts.push(block.text);
                            }
                        }
                        if (textParts.length) {
                            yield { type: 'tool', text: textParts.join('\n') };
                        }
                        break;
                    }
                    // ── Result: final summary ──
                    case 'result': {
                        const maxT = params.maxTurns ?? 100;
                        const numTurns = msg.num_turns;
                        const hitTurnLimit = Boolean(numTurns && numTurns >= maxT);
                        yield {
                            type: 'result',
                            text: String(msg.result ?? ''),
                            data: {
                                duration_ms: msg.duration_ms,
                                total_cost_usd: msg.total_cost_usd,
                                num_turns: numTurns,
                                is_error: msg.is_error,
                                hitTurnLimit,
                            },
                        };
                        break;
                    }
                    // Skip everything else: stream_event, user, tool_progress, etc.
                    default:
                        break;
                }
            }
        }
        catch (err) {
            if (!controller.signal.aborted) {
                yield { type: 'error', text: err instanceof Error ? err.message : String(err) };
            }
        }
        finally {
            activeSessions.delete(internalId);
        }
    }
    async abort(sessionId) {
        const controller = activeSessions.get(sessionId);
        if (controller) {
            controller.abort();
            activeSessions.delete(sessionId);
        }
    }
}
//# sourceMappingURL=claude-code.js.map