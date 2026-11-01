import { randomBytes } from "node:crypto";
import { WorkspaceError } from "@task/workspace/errors";
import { buildWorkspaceIndex } from "@task/workspace/indexing/incremental";
import { parseFrontmatter, serializeMarkdown } from "@task/workspace/indexing/metadata";
import type {
  DocumentSummary,
  Recurrence,
  TaskCreateInput,
  TaskPriority,
  WorkspaceContext,
} from "@task/workspace/indexing/types";
import { createFile, createTask } from "@task/workspace/operations/mutate";
import { findDocument } from "@task/workspace/operations/query";
import { resolveSafeWorkspacePath } from "@task/workspace/paths/safe-path";

export type TemplateDefaults = {
  priority?: TaskPriority;
  tags?: string[];
  estimate?: number;
  watchers?: string[];
  recurrence?: Recurrence;
};

export type TaskTemplate = {
  id: string;
  name: string;
  path: string;
  defaults: TemplateDefaults;
};

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "template"
  );
}

function defaultsOf(document: DocumentSummary): TemplateDefaults {
  const raw = document.metadata.extra?.defaults;
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as TemplateDefaults)
    : {};
}

export async function listTemplates(context: WorkspaceContext): Promise<TaskTemplate[]> {
  const index = await buildWorkspaceIndex(context);
  return [...index.documents.values()]
    .filter((document) => document.metadata.type === "task-template")
    .map((document) => ({
      id: document.metadata.id,
      name: document.metadata.name,
      path: document.path,
      defaults: defaultsOf(document),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Saves a reusable task body, with optional default fields, under the workspace templates folder. */
export async function createTemplate(
  context: WorkspaceContext,
  input: { name: string; body: string; defaults?: TemplateDefaults },
): Promise<TaskTemplate> {
  const name = input.name.trim();
  if (!name) throw new WorkspaceError("invalid_input", "A template needs a name");
  if (!input.body.trim()) throw new WorkspaceError("invalid_input", "A template needs a body");
  const id = `TPL-${randomBytes(6).toString("hex").toUpperCase()}`;
  const path = `templates/${slug(name)}.md`;
  await resolveSafeWorkspacePath(context.root, path);
  await createFile(
    context,
    path,
    serializeMarkdown(
      {
        id,
        name,
        type: "task-template",
        extra: { created_at: new Date().toISOString(), defaults: input.defaults ?? {} },
      },
      `${input.body.trimEnd()}\n`,
    ),
  );
  return { id, name, path, defaults: input.defaults ?? {} };
}

/** Creates a task from a template: its body and default fields, with the given title and group. */
export async function createTaskFromTemplate(
  context: WorkspaceContext,
  templateIdentifier: string,
  input: Pick<TaskCreateInput, "title" | "group"> & Partial<TaskCreateInput>,
): Promise<DocumentSummary> {
  const template = findDocument(await buildWorkspaceIndex(context), templateIdentifier);
  if (template.metadata.type !== "task-template")
    throw new WorkspaceError("invalid_input", `${templateIdentifier} is not a task template`);
  const absolute = await resolveSafeWorkspacePath(context.root, template.path);
  const body = parseFrontmatter(await Bun.file(absolute).text()).body;
  const defaults = defaultsOf(template);
  const retitled = body.replace(/^\s*#\s+.*$/m, `# ${input.title.trim()}`);
  return createTask(context, {
    ...(defaults.priority ? { priority: defaults.priority } : {}),
    ...(defaults.tags ? { tags: defaults.tags } : {}),
    ...(defaults.estimate !== undefined ? { estimate: defaults.estimate } : {}),
    ...(defaults.watchers ? { watchers: defaults.watchers } : {}),
    ...(defaults.recurrence ? { recurrence: defaults.recurrence } : {}),
    ...(Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as Partial<TaskCreateInput>),
    title: input.title,
    group: input.group,
    body: input.body ?? retitled,
  });
}
