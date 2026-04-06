# agent-os kanban — MCP App

A kanban board that renders directly inside Claude, showing all tasks from your `lists/` folder.

## How it works

- Reads every `.md` and `.yml` file in your agent-os `lists/` directory
- Renders a kanban board with four columns: Ready, In Progress, Blocked, Done
- Click a card to expand it and move it to another column (writes back to the file)
- Works in Claude.ai, Claude Desktop, and any MCP App-compatible client

## Run it

```bash
# 1. Install
npm install

# 2. Build the UI
npm run build

# 3. Start the server (point it at your agent-os project)
AGENT_OS_DIR=/path/to/your/agent-os-project npm run serve
```

The server starts at http://localhost:3001/mcp

## Connect to Claude

You need to expose the server publicly so Claude can reach it. Use cloudflared:

```bash
npx cloudflared tunnel --url http://localhost:3001
```

Copy the generated URL (e.g. `https://random-name.trycloudflare.com`) then:

1. Open Claude → Profile → Settings → Connectors
2. Add custom connector → paste the URL + `/mcp`
3. Start a new chat and ask: **"Show me my task board"**

Claude will call the `show_kanban` tool and render the board inline.

## Use it with Claude Desktop (local, no tunnel needed)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-os-kanban": {
      "command": "npx",
      "args": ["tsx", "/path/to/agent-os/mcp-kanban/server.ts"],
      "env": {
        "AGENT_OS_DIR": "/path/to/your/agent-os-project"
      }
    }
  }
}
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `AGENT_OS_DIR` | `.` (current dir) | Path to your agent-os project root |
| `PORT` | `3001` | Port the MCP server listens on |
