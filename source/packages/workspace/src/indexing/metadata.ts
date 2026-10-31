import type {
  DocumentMetadata,
  TaskExtra,
  TaskPriority,
  TaskStatus,
} from "@task/workspace/indexing/types";

const taskStatuses = new Set<TaskStatus>(["planned", "in-progress", "blocked", "completed"]);
const taskPriorities = new Set<TaskPriority>(["low", "medium", "high"]);

export function hashContent(content: string): string {
  return new Bun.CryptoHasher("sha256").update(content).digest("hex");
}

export function parseFrontmatter(content: string): {
  metadata: DocumentMetadata;
  values: Record<string, unknown>;
  body: string;
} {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) throw new Error("Missing YAML frontmatter block");
  const parsed = Bun.YAML.parse(match[1]);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Frontmatter must be a YAML mapping");
  }
  const values = parsed as Record<string, unknown>;
  const scalar = (key: string): string | undefined =>
    typeof values[key] === "string" ? values[key] : undefined;
  const id = scalar("id");
  const name = scalar("name");
  const type = scalar("type");
  if (!id?.trim() || !name?.trim() || !type?.trim())
    throw new Error("Frontmatter requires non-empty string id, name, and type");
  const rawTags = values.tags ?? [];
  if (!Array.isArray(rawTags) || rawTags.some((tag) => typeof tag !== "string")) {
    throw new Error("Tags must be a YAML string sequence");
  }
  const tags = rawTags as string[];
  if (new Set(tags).size !== tags.length) throw new Error("Tags must not contain duplicates");
  if (tags.some((tag) => !tag)) throw new Error("Tags must be non-empty strings");
  const allowedFields = new Set(
    type === "task"
      ? [
          "id",
          "name",
          "type",
          "tags",
          "status",
          "priority",
          "assignee",
          "project",
          "start_at",
          "due_at",
          "created_at",
          "updated_at",
          "archived_at",
          "depends_on",
          "extra",
        ]
      : type === "decision"
        ? ["id", "name", "type", "tags", "status", "created_at", "extra"]
        : ["id", "name", "type", "tags", "extra"],
  );
  for (const key of Object.keys(values)) {
    if (!allowedFields.has(key)) throw new Error(`Unknown ${type} metadata field: ${key}`);
  }
  const extra = values.extra;
  if (
    extra !== undefined &&
    (typeof extra !== "object" || extra === null || Array.isArray(extra))
  ) {
    throw new Error("extra must be a YAML mapping");
  }
  if (type === "task") {
    if (values.status !== undefined && !taskStatuses.has(values.status as TaskStatus)) {
      throw new Error("Task status must be planned, in-progress, blocked, or completed");
    }
    if (values.priority !== undefined && !taskPriorities.has(values.priority as TaskPriority)) {
      throw new Error("Task priority must be low, medium, or high");
    }
    for (const key of [
      "assignee",
      "project",
      "start_at",
      "due_at",
      "created_at",
      "updated_at",
      "archived_at",
    ] as const) {
      if (values[key] !== undefined && typeof values[key] !== "string") {
        throw new Error(`${key} must be a string`);
      }
    }
    for (const key of ["start_at", "due_at"] as const) {
      const value = values[key];
      if (typeof value === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`${key} must use YYYY-MM-DD format`);
      }
      if (typeof value === "string") {
        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
          throw new Error(`${key} must be a valid calendar date`);
        }
      }
    }
    if (
      typeof values.start_at === "string" &&
      typeof values.due_at === "string" &&
      values.start_at > values.due_at
    ) {
      throw new Error("start_at must not be after due_at");
    }
    if (
      values.depends_on !== undefined &&
      (!Array.isArray(values.depends_on) ||
        values.depends_on.some((id) => typeof id !== "string" || !id) ||
        new Set(values.depends_on).size !== values.depends_on.length)
    ) {
      throw new Error("depends_on must be a sequence of task IDs");
    }
    const history = (extra as Record<string, unknown> | undefined)?.status_history;
    const hiddenFromRecent = (extra as Record<string, unknown> | undefined)?.hidden_from_recent;
    if (hiddenFromRecent !== undefined && typeof hiddenFromRecent !== "boolean") {
      throw new Error("extra.hidden_from_recent must be a boolean");
    }
    if (history !== undefined) {
      if (!Array.isArray(history)) throw new Error("extra.status_history must be a sequence");
      let previous: TaskStatus | undefined;
      for (const [index, item] of history.entries()) {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          throw new Error(`extra.status_history[${index}] must be a mapping`);
        }
        const event = item as Record<string, unknown>;
        if (
          Object.keys(event).some((key) => !["from", "to", "at"].includes(key)) ||
          !taskStatuses.has(event.from as TaskStatus) ||
          !taskStatuses.has(event.to as TaskStatus) ||
          event.from === event.to ||
          typeof event.at !== "string" ||
          Number.isNaN(Date.parse(event.at))
        ) {
          throw new Error(`extra.status_history[${index}] is invalid`);
        }
        if (previous && event.from !== previous) {
          throw new Error(`extra.status_history[${index}] does not continue the prior status`);
        }
        previous = event.to as TaskStatus;
      }
    }
  }
  const dates: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (
      /(date|at|until|due)$/i.test(key) &&
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      dates[key] = value;
    }
  }
  const metadata: DocumentMetadata = {
    id,
    name,
    type,
    tags,
    ...(type === "task"
      ? { status: scalar("status") ?? "planned" }
      : scalar("status")
        ? { status: scalar("status") }
        : {}),
    ...(type === "task"
      ? {
          priority: taskPriorities.has(values.priority as TaskPriority)
            ? (values.priority as TaskPriority)
            : "medium",
        }
      : taskPriorities.has(values.priority as TaskPriority)
        ? { priority: values.priority as TaskPriority }
        : {}),
    ...(scalar("assignee") ? { assignee: scalar("assignee") } : {}),
    ...(scalar("project") ? { project: scalar("project") } : {}),
    ...(scalar("start_at") ? { start_at: scalar("start_at") } : {}),
    ...(scalar("due_at") ? { due_at: scalar("due_at") } : {}),
    ...(scalar("created_at") ? { created_at: scalar("created_at") } : {}),
    ...(scalar("updated_at") ? { updated_at: scalar("updated_at") } : {}),
    ...(scalar("archived_at") ? { archived_at: scalar("archived_at") } : {}),
    ...(Array.isArray(values.depends_on) ? { depends_on: values.depends_on as string[] } : {}),
    ...(extra !== undefined ? { extra: extra as TaskExtra } : {}),
    dates,
  };
  return { metadata, values, body: content.slice(match[0].length) };
}

export function parseMetadata(content: string): DocumentMetadata {
  return parseFrontmatter(content).metadata;
}

export function serializeMarkdown(values: Record<string, unknown>, body: string): string {
  return `---\n${Bun.YAML.stringify(values).trimEnd()}\n---\n${body.startsWith("\n") || body.length === 0 ? "" : "\n"}${body}`;
}
