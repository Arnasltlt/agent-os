import { App } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface Task {
  id: string;
  title: string;
  status: string;
  priority?: string;
  description?: string;
  owner?: string;
  source_file?: string;
}

type Column = { id: string; label: string; color: string };

const COLUMNS: Column[] = [
  { id: "ready",       label: "Ready",       color: "#6366f1" },
  { id: "in_progress", label: "In Progress", color: "#f59e0b" },
  { id: "blocked",     label: "Blocked",     color: "#ef4444" },
  { id: "done",        label: "Done",        color: "#22c55e" },
];

const PRIORITY_DOT: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#facc15",
  low:      "#94a3b8",
};

// ------------------------------------------------------------------
// MCP App instance (module-level, not inside React)
// ------------------------------------------------------------------

const mcpApp = new App({ name: "agent-os-kanban", version: "1.0.0" });

// ------------------------------------------------------------------
// Components
// ------------------------------------------------------------------

function TaskCard({
  task,
  onStatusChange,
}: {
  task: Task;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const dot = task.priority ? PRIORITY_DOT[task.priority] ?? "#94a3b8" : undefined;

  return (
    <div
      style={{
        background: "#1e1e2e",
        border: "1px solid #2d2d3f",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 8,
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => setExpanded((e) => !e)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {dot && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: dot,
              flexShrink: 0,
              marginTop: 5,
            }}
          />
        )}
        <span style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.4 }}>
          {task.title}
        </span>
      </div>

      {task.owner && (
        <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 99,
              background: task.owner === "founder" ? "#7c3aed22" : "#0ea5e922",
              color: task.owner === "founder" ? "#a78bfa" : "#38bdf8",
              border: `1px solid ${task.owner === "founder" ? "#7c3aed44" : "#0ea5e944"}`,
            }}
          >
            {task.owner}
          </span>
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
          {task.description && (
            <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
              {task.description}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {COLUMNS.filter((c) => c.id !== task.status).map((col) => (
              <button
                key={col.id}
                onClick={() => onStatusChange(task.id, col.id)}
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 6,
                  border: `1px solid ${col.color}44`,
                  background: `${col.color}18`,
                  color: col.color,
                  cursor: "pointer",
                }}
              >
                → {col.label}
              </button>
            ))}
          </div>
          {task.source_file && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#475569" }}>
              lists/{task.source_file}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KanbanBoard() {
  const app = useApp(mcpApp);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial tasks from the tool result the host pushes
  useEffect(() => {
    app.ontoolresult = (result) => {
      try {
        const text = result.content?.find((c: { type: string }) => c.type === "text");
        if (text && "text" in text) {
          setTasks(JSON.parse(text.text as string));
        }
      } catch {
        setError("Failed to parse task data");
      } finally {
        setLoading(false);
      }
    };
  }, [app]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const result = await app.callServerTool({ name: "show_kanban", arguments: {} });
      const text = result.content?.find((c: { type: string }) => c.type === "text");
      if (text && "text" in text) {
        setTasks(JSON.parse(text.text as string));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(taskId: string, newStatus: string) {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    try {
      await app.callServerTool({
        name: "update_task_status",
        arguments: { task_id: taskId, new_status: newStatus },
      });
    } catch {
      // Revert on failure
      refresh();
    }
  }

  const byStatus = (status: string) => tasks.filter((t) => t.status === status);

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        background: "#0f0f1a",
        minHeight: "100vh",
        padding: "16px",
        color: "#e2e8f0",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "#f1f5f9" }}>
            agent-os
          </h1>
          <p style={{ fontSize: 12, margin: 0, color: "#475569" }}>
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} across {
              [...new Set(tasks.map((t) => t.source_file))].length
            } list{[...new Set(tasks.map((t) => t.source_file))].length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            fontSize: 12,
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid #2d2d3f",
            background: "#1e1e2e",
            color: "#94a3b8",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "..." : "↻ Refresh"}
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "#450a0a",
            border: "1px solid #7f1d1d",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: "#fca5a5",
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        {COLUMNS.map((col) => {
          const colTasks = byStatus(col.id);
          return (
            <div key={col.id}>
              {/* Column header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                  paddingBottom: 8,
                  borderBottom: `2px solid ${col.color}44`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: col.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: col.color }}>
                  {col.label}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    color: "#475569",
                    background: "#1e1e2e",
                    borderRadius: 99,
                    padding: "1px 7px",
                    border: "1px solid #2d2d3f",
                  }}
                >
                  {colTasks.length}
                </span>
              </div>

              {/* Cards */}
              {loading && colTasks.length === 0 ? (
                <div style={{ fontSize: 12, color: "#334155", padding: "8px 0" }}>
                  Loading...
                </div>
              ) : colTasks.length === 0 ? (
                <div style={{ fontSize: 12, color: "#334155", padding: "8px 0" }}>
                  —
                </div>
              ) : (
                colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Bootstrap
// ------------------------------------------------------------------

mcpApp.connect();
const root = createRoot(document.getElementById("root")!);
root.render(<KanbanBoard />);
