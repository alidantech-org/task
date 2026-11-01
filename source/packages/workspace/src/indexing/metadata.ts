import type {
  Attachment,
  DocumentMetadata,
  Recurrence,
  TaskExtra,
  TaskLink,
  TaskPriority,
  TaskStatus,
} from "@task/workspace/indexing/types";

const taskStatuses = new Set<TaskStatus>([
  "planned",
  "in-progress",
  "blocked",
  "completed",
  "archived",
]);
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
          "order",
          "parent",
          "estimate",
          "links",
          "watchers",
          "attachments",
          "recurrence",
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
      throw new Error("Task status must be planned, in-progress, blocked, completed, or archived");
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
    validateTaskExtras(values);
    const history = (extra as Record<string, unknown> | undefined)?.status_history;
    const hiddenFromRecent = (extra as Record<string, unknown> | undefined)?.hidden_from_recent;
    if (hiddenFromRecent !== undefined && typeof hiddenFromRecent !== "boolean") {
      throw new Error("extra.hidden_from_recent must be a boolean");
    }
    validateTracking((extra as Record<string, unknown> | undefined)?.tracking);
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
    ...(typeof values.order === "number" ? { order: values.order } : {}),
    ...(typeof values.parent === "string" ? { parent: values.parent } : {}),
    ...(typeof values.estimate === "number" ? { estimate: values.estimate } : {}),
    ...(Array.isArray(values.links) ? { links: values.links as TaskLink[] } : {}),
    ...(Array.isArray(values.watchers) ? { watchers: values.watchers as string[] } : {}),
    ...(Array.isArray(values.attachments)
      ? { attachments: values.attachments as Attachment[] }
      : {}),
    ...(isMapping(values.recurrence) ? { recurrence: values.recurrence as Recurrence } : {}),
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

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: Record<string, unknown>, key: string, label: string): void {
  if (value[key] !== undefined && typeof value[key] !== "string")
    throw new Error(`${label}.${key} must be a string`);
}

function validateTracking(tracking: unknown): void {
  if (tracking === undefined) return;
  if (!isMapping(tracking) || Object.keys(tracking).some((key) => key !== "segments"))
    throw new Error("extra.tracking must be a mapping with only segments");
  if (!Array.isArray(tracking.segments))
    throw new Error("extra.tracking.segments must be a sequence");
  for (const [index, segment] of tracking.segments.entries()) {
    const label = `extra.tracking.segments[${index}]`;
    if (!isMapping(segment)) throw new Error(`${label} must be a mapping`);
    const allowed = [
      "base_ref",
      "base_commit",
      "started_at",
      "end_ref",
      "ended_at",
      "end_error",
      "truncated",
      "summary",
    ];
    if (Object.keys(segment).some((key) => !allowed.includes(key)))
      throw new Error(`${label} has an unknown field`);
    if (typeof segment.base_ref !== "string" || !segment.base_ref)
      throw new Error(`${label}.base_ref must be a string`);
    if (typeof segment.started_at !== "string" || Number.isNaN(Date.parse(segment.started_at)))
      throw new Error(`${label}.started_at must be a timestamp`);
    for (const key of ["base_commit", "end_ref", "end_error"]) optionalString(segment, key, label);
    if (segment.truncated !== undefined && typeof segment.truncated !== "boolean")
      throw new Error(`${label}.truncated must be a boolean`);
    if (segment.ended_at !== undefined && Number.isNaN(Date.parse(String(segment.ended_at))))
      throw new Error(`${label}.ended_at must be a timestamp`);
    if (segment.summary !== undefined) {
      const summary = segment.summary;
      if (
        !isMapping(summary) ||
        Object.keys(summary).some((key) => !["files", "insertions", "deletions"].includes(key)) ||
        !["files", "insertions", "deletions"].every(
          (key) => Number.isInteger(summary[key]) && Number(summary[key]) >= 0,
        )
      )
        throw new Error(`${label}.summary is invalid`);
    }
  }
}

export const maxAttachmentBytes = 1_000_000;
const linkTypes = new Set(["blocks", "relates", "duplicates"]);
const recurrenceUnits = new Set(["day", "week", "month"]);

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) throw new Error(`${label} has an unknown field: ${key}`);
}

/** Validates the optional task fields for ordering, hierarchy, relations, watchers, files and recurrence. */
function validateTaskExtras(values: Record<string, unknown>): void {
  if (
    values.order !== undefined &&
    (typeof values.order !== "number" || !Number.isFinite(values.order))
  )
    throw new Error("order must be a finite number");
  if (values.parent !== undefined && (typeof values.parent !== "string" || !values.parent))
    throw new Error("parent must be a task id");
  if (
    values.estimate !== undefined &&
    (typeof values.estimate !== "number" ||
      !Number.isFinite(values.estimate) ||
      values.estimate < 0)
  )
    throw new Error("estimate must be a number of zero or more");
  if (values.links !== undefined) {
    if (!Array.isArray(values.links)) throw new Error("links must be a sequence");
    const seen = new Set<string>();
    for (const [index, link] of values.links.entries()) {
      const label = `links[${index}]`;
      if (!isMapping(link)) throw new Error(`${label} must be a mapping`);
      onlyKeys(link, ["type", "task"], label);
      if (typeof link.type !== "string" || !linkTypes.has(link.type))
        throw new Error(`${label}.type must be blocks, relates or duplicates`);
      if (typeof link.task !== "string" || !link.task)
        throw new Error(`${label}.task must be a task id`);
      const key = `${link.type}:${link.task}`;
      if (seen.has(key)) throw new Error(`${label} duplicates another link`);
      seen.add(key);
    }
  }
  if (values.watchers !== undefined) {
    if (
      !Array.isArray(values.watchers) ||
      values.watchers.some((name) => typeof name !== "string" || !name.trim()) ||
      new Set(values.watchers).size !== values.watchers.length
    )
      throw new Error("watchers must be a sequence of unique names");
  }
  if (values.attachments !== undefined) {
    if (!Array.isArray(values.attachments)) throw new Error("attachments must be a sequence");
    for (const [index, item] of values.attachments.entries()) {
      const label = `attachments[${index}]`;
      if (!isMapping(item)) throw new Error(`${label} must be a mapping`);
      onlyKeys(item, ["kind", "name", "path", "url", "size", "added_at", "added_by"], label);
      if (typeof item.name !== "string" || !item.name)
        throw new Error(`${label}.name must be a string`);
      if (typeof item.added_at !== "string" || Number.isNaN(Date.parse(item.added_at)))
        throw new Error(`${label}.added_at must be a timestamp`);
      optionalString(item, "added_by", label);
      if (item.kind === "file") {
        if (
          typeof item.path !== "string" ||
          !item.path ||
          item.path.startsWith("/") ||
          item.path.split("/").includes("..")
        )
          throw new Error(`${label}.path must be a safe workspace-relative path`);
        if (
          typeof item.size !== "number" ||
          !Number.isInteger(item.size) ||
          item.size < 0 ||
          item.size > maxAttachmentBytes
        )
          throw new Error(`${label}.size must be an integer up to ${maxAttachmentBytes} bytes`);
      } else if (item.kind === "link") {
        if (typeof item.url !== "string" || !/^https?:\/\/\S+$/i.test(item.url))
          throw new Error(`${label}.url must be an http or https address`);
      } else throw new Error(`${label}.kind must be file or link`);
    }
  }
  if (values.recurrence !== undefined) {
    const recurrence = values.recurrence;
    if (!isMapping(recurrence)) throw new Error("recurrence must be a mapping");
    onlyKeys(recurrence, ["every", "interval", "until"], "recurrence");
    if (typeof recurrence.every !== "string" || !recurrenceUnits.has(recurrence.every))
      throw new Error("recurrence.every must be day, week or month");
    if (!Number.isInteger(recurrence.interval) || Number(recurrence.interval) < 1)
      throw new Error("recurrence.interval must be a whole number of 1 or more");
    if (recurrence.until !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(recurrence.until)))
      throw new Error("recurrence.until must be YYYY-MM-DD");
  }
}
