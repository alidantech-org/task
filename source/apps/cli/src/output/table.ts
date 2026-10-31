import type { Style } from "#/output/style";
import type { Symbols } from "#/output/symbols";
import { displayWidth, terminalWidth, truncate } from "#/output/text";

export interface TableTask {
  id: string;
  name: string;
  status?: string;
  priority?: string;
  assignee?: string;
  due?: string;
}

export interface TableOptions {
  width: number;
  symbols: Symbols;
  style: Style;
  env: Record<string, string | undefined>;
}

function pad(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - displayWidth(value)));
}

export function renderTaskTable(tasks: readonly TableTask[], options: TableOptions): string[] {
  if (!tasks.length) return [options.style.muted("No tasks found.")];
  const width = terminalWidth(options.env, options.width);
  const compact = width < 60;
  if (compact) {
    return tasks.flatMap((task) => [
      `${options.symbols.task} ${options.style.accent(task.id)} ${truncate(task.name, Math.max(8, width - 5))}`,
      `  ${task.status ?? "—"} · ${task.priority ?? "—"}${task.assignee ? ` · ${task.assignee}` : ""}`,
    ]);
  }
  const rows = tasks.map((task) => ({
    id: truncate(task.id, 18),
    title: truncate(task.name, Math.max(20, width - 61)),
    status: task.status ?? "—",
    priority: task.priority ?? "—",
    assignee: truncate(task.assignee ?? "—", 16),
    due: task.due ?? "—",
  }));
  const widths = {
    id: 14,
    title: Math.max(20, width - 61),
    status: 13,
    priority: 10,
    assignee: 16,
    due: 10,
  };
  const header = `${pad("ID", widths.id)}  ${pad("TASK", widths.title)}  ${pad("STATUS", widths.status)}  ${pad("PRIORITY", widths.priority)}  ${pad("ASSIGNEE", widths.assignee)}  DUE`;
  return [
    options.style.muted(header),
    ...rows.map(
      (row) =>
        `${pad(options.style.accent(row.id), widths.id)}  ${pad(row.title, widths.title)}  ${pad(row.status, widths.status)}  ${pad(row.priority, widths.priority)}  ${pad(row.assignee, widths.assignee)}  ${row.due}`,
    ),
  ];
}
