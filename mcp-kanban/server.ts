import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

// ------------------------------------------------------------------
// Constants from ext-apps (app-bridge exports)
// ------------------------------------------------------------------
const RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";
const resourceUri = "ui://agent-os-kanban/mcp-app.html";

// ------------------------------------------------------------------
// Config
// ------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_OS_DIR = process.env.AGENT_OS_DIR ?? path.resolve(__dirname, "..");
const LISTS_DIR = path.join(AGENT_OS_DIR, "lists");
const PORT = Number(process.env.PORT ?? 3001);

// ------------------------------------------------------------------
// Task parsing
// ------------------------------------------------------------------

interface Task {
  id: string;
  title: string;
  status: string;
  priority?: string;
  description?: string;
  owner?: string;
  depends_on?: string[];
  source_file: string;
}

function parseMarkdownTasks(content: string, filename: string): Task[] {
  const tasks: Task[] = [];
  let idCounter = 1;
  for (const line of content.split("\n")) {
    const match = line.match(/^-\s+\[(x| )\]\s+(.+)$/i);
    if (!match) continue;
    const done = match[1].toLowerCase() === "x";
    const rawTitle = match[2].trim();
    const ownerMatch = rawTitle.match(/←\s*(agent|founder[^$]*)/i);
    const owner = ownerMatch ? ownerMatch[1].split(" ")[0].toLowerCase() : undefined;
    const title = rawTitle.replace(/←.*$/, "").trim();
    tasks.push({
      id: `${path.basename(filename, path.extname(filename))}-${idCounter++}`,
      title,
      status: done ? "done" : "ready",
      owner,
      source_file: filename,
    });
  }
  return tasks;
}

function parseYamlTasks(content: string, filename: string): Task[] {
  try {
    const data = yaml.load(content) as { list?: Task[] } | Task[] | null;
    if (!data) return [];
    const raw = Array.isArray(data) ? data : (data as { list?: Task[] }).list ?? [];
    return raw.map((t) => ({ ...t, source_file: filename }));
  } catch {
    return [];
  }
}

async function loadAllTasks(): Promise<Task[]> {
  const tasks: Task[] = [];
  let files: string[] = [];
  try {
    files = await fs.readdir(LISTS_DIR);
  } catch {
    return [];
  }
  for (const file of files) {
    if (file.startsWith(".")) continue;
    const filePath = path.join(LISTS_DIR, file);
    const content = await fs.readFile(filePath, "utf-8");
    if (file.endsWith(".yml") || file.endsWith(".yaml")) {
      tasks.push(...parseYamlTasks(content, file));
    } else if (file.endsWith(".md")) {
      tasks.push(...parseMarkdownTasks(content, file));
    }
  }
  return tasks;
}

async function updateTaskStatus(taskId: string, newStatus: string): Promise<boolean> {
  let files: string[] = [];
  try {
    files = await fs.readdir(LISTS_DIR);
  } catch {
    return false;
  }
  for (const file of files) {
    const filePath = path.join(LISTS_DIR, file);
    const content = await fs.readFile(filePath, "utf-8");

    if (file.endsWith(".yml") || file.endsWith(".yaml")) {
      const data = yaml.load(content) as { list?: Task[] } | Task[] | null;
      if (!data) continue;
      const list = Array.isArray(data) ? data : (data as { list?: Task[] }).list ?? [];
      const task = list.find((t) => t.id === taskId);
      if (!task) continue;
      task.status = newStatus;
      const updated = Array.isArray(data) ? yaml.dump(data) : yaml.dump({ ...(data as object), list });
      await fs.writeFile(filePath, updated, "utf-8");
      return true;
    } else if (file.endsWith(".md")) {
      const tasks = parseMarkdownTasks(content, file);
      const task = tasks.find((t) => t.id === taskId);
      if (!task) continue;
      let lineIdx = 0;
      const lines = content.split("\n").map((line) => {
        const match = line.match(/^-\s+\[(x| )\]\s+(.+)$/i);
        if (match) {
          lineIdx++;
          const lineId = `${path.basename(file, path.extname(file))}-${lineIdx}`;
          if (lineId === taskId) {
            const checked = newStatus === "done" ? "x" : " ";
            return line.replace(/\[(x| )\]/i, `[${checked}]`);
          }
        }
        return line;
      });
      await fs.writeFile(filePath, lines.join("\n"), "utf-8");
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------
// MCP Server
// ------------------------------------------------------------------

const server = new McpServer({ name: "agent-os-kanban", version: "1.0.0" });

// show_kanban — the main tool that triggers the UI
server.tool(
  "show_kanban",
  "Shows a live kanban board of all tasks in this agent-os project's lists/ folder. Use this to get an overview of what's ready, in progress, blocked, or done.",
  {},
  async () => {
    const tasks = await loadAllTasks();
    return {
      content: [{ type: "text", text: JSON.stringify(tasks) }],
      _meta: {
        ui: { resourceUri },
      },
    };
  },
);

// update_task_status — called from the UI when dragging/clicking cards
server.tool(
  "update_task_status",
  "Update the status of a task in lists/",
  { task_id: z.string(), new_status: z.string() },
  async ({ task_id, new_status }) => {
    const ok = await updateTaskStatus(task_id, new_status);
    return {
      content: [{ type: "text", text: ok ? "updated" : "task not found" }],
    };
  },
);

// Resource: serve the bundled HTML
server.resource(
  "kanban-ui",
  resourceUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => {
    const html = await fs.readFile(path.join(__dirname, "dist", "mcp-app.html"), "utf-8");
    return {
      contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
    };
  },
);

// ------------------------------------------------------------------
// HTTP transport
// ------------------------------------------------------------------

const app = express();
app.use(cors());
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`agent-os kanban → http://localhost:${PORT}/mcp`);
  console.log(`Reading lists from: ${LISTS_DIR}`);
});
