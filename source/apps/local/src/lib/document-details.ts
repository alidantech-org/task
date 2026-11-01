export type DetailRow = { label: string; value: string; values?: string[] };

type DetailSource = {
  id: string;
  name: string;
  type: string;
  path: string;
  tags: readonly string[];
  status?: string;
  priority?: string;
  assignee?: string;
  project?: string;
  start_at?: string;
  due_at?: string;
  created_at?: string;
  updated_at?: string;
  archived_at?: string;
  depends_on?: readonly string[];
  parent?: string;
  estimate?: number;
  watchers?: readonly string[];
  size: number;
  modifiedAt: number;
  extra?: Record<string, unknown>;
};

const hiddenExtra = new Set(["status_history", "tracking", "hidden_from_recent", "archived_from"]);

function formatDate(value: string): string {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat(
    "en",
    dateOnly
      ? { month: "short", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
  ).format(dateOnly ? Date.parse(`${value}T12:00:00`) : time);
}

function formatSize(bytes: number): string {
  return bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(bytes < 100_000 ? 1 : 0)} KB`;
}

function formatExtra(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** The frontmatter and file facts of a document as labelled rows; empty values are left out. */
export function detailRows(source: DetailSource): DetailRow[] {
  const rows: DetailRow[] = [];
  const add = (label: string, value: string | number | undefined, values?: string[]) => {
    if (value === undefined || value === "") return;
    rows.push({ label, value: String(value), ...(values ? { values } : {}) });
  };
  add("ID", source.id);
  add("Type", source.type);
  add("Status", source.status);
  add("Priority", source.priority);
  add("Assignee", source.assignee);
  add("Project", source.project);
  if (source.tags.length > 0) add("Tags", source.tags.join(", "), [...source.tags]);
  add("Parent", source.parent);
  add("Estimate", source.estimate);
  if (source.depends_on?.length)
    add("Depends on", source.depends_on.join(", "), [...source.depends_on]);
  if (source.watchers?.length) add("Watchers", source.watchers.join(", "), [...source.watchers]);
  for (const [label, value] of [
    ["Starts", source.start_at],
    ["Due", source.due_at],
    ["Created", source.created_at],
    ["Updated", source.updated_at],
    ["Archived", source.archived_at],
  ] as const)
    if (value) add(label, formatDate(value));
  for (const [key, value] of Object.entries(source.extra ?? {}))
    if (!hiddenExtra.has(key) && value !== undefined && value !== null)
      add(key.replace(/_/g, " "), formatExtra(value));
  add("Path", source.path);
  add("Size", formatSize(source.size));
  add("Modified", formatDate(new Date(source.modifiedAt).toISOString()));
  return rows;
}
