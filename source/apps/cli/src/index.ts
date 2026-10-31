#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cancel, intro, isCancel, outro, select, text } from "@clack/prompts";
import type { DocumentSummary } from "@task/workspace";
import {
  archiveTaskGroup,
  createDocument,
  createTask,
  createTaskGroup,
  findDocument,
  getDocument,
  listDocuments,
  listTaskGroups,
  listTasks,
  listWorkspaceTree,
  readWorkspaceIndex,
  replaceDocumentBody,
  resolveWorkspace,
  restoreTaskGroup,
  searchWorkspace,
  updateTask,
  validateWorkspace,
  WorkspaceError,
} from "@task/workspace";
import pc from "picocolors";
import type { ParsedArgs } from "#/command";
import {
  getCliMetadata,
  isWorkspaceError,
  optionList,
  optionString,
  parseArgs,
  taskPriorities,
  taskStatuses,
} from "#/command";

const version = "0.1.0";
let args: ParsedArgs;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes("--json"))
    console.error(JSON.stringify({ error: "invalid_input", message }));
  else console.error(`task: ${message}`);
  process.exit(1);
}
const metadata = getCliMetadata(version);
const json = args.options.has("json");
const plain = args.options.has("plain") || args.options.has("no-color") || !process.stdout.isTTY;
const color = (value: string, style: (value: string) => string): string =>
  plain ? value : style(value);
const line = (value = ""): void => {
  if (!args.options.has("quiet") || json) console.log(value);
};
const errorLine = (value: string): void => console.error(color(value, pc.red));

function printHelp(): void {
  line("TASK · Your work, organised.");
  line("Usage: task [command] [options]");
  line("");
  line("Commands:");
  line("  (no command)           Workspace overview");
  line("  doctor                 Check Bun and workspace health");
  line("  info | status | stats  Workspace information and counts");
  line("  tree                   Show Markdown workspace paths");
  line("  group create|list      Manage task groups");
  line("  list [filters]         List active tasks (use --archived for archived)");
  line("  show <id|path>         Show a task or document");
  line("  search <query>         Search metadata and Markdown text");
  line("  create                 Create a task in a group");
  line("  update <id>            Update task metadata");
  line("  edit <id>              Edit the Markdown body in $EDITOR");
  line("  archive <group>        Archive a completed group");
  line("  restore <group-id>     Restore an archived group");
  line("  validate [scope]       Validate tasks, docs, links, and references");
  line("  docs list|show|search|tree|open|create");
  line("  index status|rebuild|verify");
  line("");
  line("Options: --workspace <path> --json --plain --no-color --quiet --verbose --help --version");
  line(
    "Task fields: --title --group --status --priority --assignee --project --tag a,b --due YYYY-MM-DD --depends-on TSK-… --extra JSON",
  );
}

function output(value: unknown): void {
  line(JSON.stringify(value, null, 2));
}

function record(summary: DocumentSummary): Record<string, unknown> {
  return {
    id: summary.metadata.id,
    name: summary.metadata.name,
    type: summary.metadata.type,
    status: summary.metadata.status,
    priority: summary.metadata.priority,
    assignee: summary.metadata.assignee,
    project: summary.metadata.project,
    tags: summary.metadata.tags,
    path: summary.path,
    modifiedAt: new Date(summary.modifiedAt).toISOString(),
  };
}

function printDocument(summary: DocumentSummary): void {
  line(`${color(summary.metadata.id, pc.cyan)}  ${summary.metadata.name}`);
  line(
    `  ${summary.metadata.type}${summary.metadata.status ? ` · ${summary.metadata.status}` : ""}${summary.metadata.priority ? ` · ${summary.metadata.priority}` : ""}`,
  );
  line(`  ${summary.path}`);
  if (summary.metadata.tags.length) line(`  tags: ${summary.metadata.tags.join(", ")}`);
}

function requiredOption(key: string): string {
  const value = optionString(args, key);
  if (!value) throw new WorkspaceError("invalid_input", `Provide --${key} <value>`);
  return value;
}

function enumOption<T extends string>(key: string, allowed: readonly T[]): T | undefined {
  const value = optionString(args, key);
  if (!value) return undefined;
  if (!allowed.includes(value as T))
    throw new WorkspaceError("invalid_input", `--${key} must be one of: ${allowed.join(", ")}`);
  return value as T;
}

function extraOption(): Record<string, unknown> | undefined {
  const raw = optionString(args, "extra");
  if (raw === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new WorkspaceError("invalid_input", "--extra must be a JSON object");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new WorkspaceError("invalid_input", "--extra must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

async function promptText(message: string, placeholder?: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new WorkspaceError(
      "invalid_input",
      `Non-interactive use requires ${placeholder ? `--${placeholder}` : "explicit arguments"}`,
    );
  const answer = await text({ message, placeholder });
  if (isCancel(answer)) {
    cancel("Cancelled.");
    process.exit(130);
  }
  return answer;
}

async function editDocumentBody(
  context: { root: string; projectRoot: string },
  summary: DocumentSummary,
  editor: string,
): Promise<void> {
  const document = await getDocument(context, summary.metadata.id);
  const directory = await mkdtemp(join(tmpdir(), "task-edit-"));
  const temporaryPath = join(directory, "document.md");
  try {
    await Bun.write(temporaryPath, document.body);
    const edit = spawnSync(editor, [temporaryPath], { stdio: "inherit", shell: true });
    if (edit.status !== 0)
      throw new WorkspaceError(
        "filesystem_error",
        `Editor exited with status ${edit.status ?? "unknown"}`,
      );
    await replaceDocumentBody(
      context,
      summary.metadata.id,
      await Bun.file(temporaryPath).text(),
      summary.contentHash,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  if (args.options.has("help") || args.command === "help") return printHelp();
  if (args.options.has("version") || args.command === "version")
    return line(`task ${metadata.version}`);
  const workspaceOverride = optionString(args, "workspace");
  const selected = await resolveWorkspace({
    workspaceOverride,
    environmentWorkspaceRoot: process.env.TASK_WORKSPACE_ROOT,
  });
  const context = { root: selected.root, projectRoot: selected.projectRoot };
  const command = args.command;

  if (
    !command &&
    !json &&
    !args.options.has("quiet") &&
    process.stdin.isTTY &&
    process.stdout.isTTY
  ) {
    const action = await select({
      message: `Task · ${selected.root}`,
      options: [
        { value: "info", label: "Workspace overview" },
        { value: "list", label: "List tasks" },
        { value: "create", label: "Create a task" },
        { value: "group-create", label: "Create a task group" },
        { value: "search", label: "Search workspace" },
        { value: "docs", label: "Browse documents" },
        { value: "validate", label: "Validate workspace" },
        { value: "quit", label: "Quit" },
      ],
    });
    if (isCancel(action)) {
      cancel("Cancelled.");
      process.exit(130);
    }
    if (action === "quit") {
      outro("Workspace unchanged.");
      return;
    }
    if (action === "group-create") {
      args = { ...args, command: "group", positionals: ["create"] };
    } else if (action === "search") {
      const query = await promptText("Search text");
      args = { ...args, command: "search", positionals: [query] };
    } else {
      args = { ...args, command: action, positionals: [] };
      if (action === "docs") args.positionals.push("list");
    }
    return main();
  }

  if (command === "doctor") {
    const majorMinorPatch = Bun.version.split(".").map(Number);
    const compatible =
      (majorMinorPatch[0] ?? 0) > 1 ||
      ((majorMinorPatch[0] ?? 0) === 1 &&
        ((majorMinorPatch[1] ?? 0) > 3 ||
          ((majorMinorPatch[1] ?? 0) === 3 && (majorMinorPatch[2] ?? 0) >= 14)));
    const index = await readWorkspaceIndex(context);
    const details = {
      bun: Bun.version,
      compatible,
      workspace: selected.root,
      documents: index.documents.size,
      invalid: index.diagnostics.length,
    };
    if (json) output(details);
    else {
      intro("Task environment check");
      line(`${compatible ? "✓" : "✗"} Bun ${Bun.version}`);
      line(`✓ Workspace ${selected.root}`);
      line(
        `${index.diagnostics.length ? "!" : "✓"} ${index.documents.size} documents · ${index.diagnostics.length} metadata diagnostics`,
      );
      outro(compatible ? "Environment check complete." : "Upgrade Bun to 1.3.14 or later.");
    }
    if (!compatible || index.diagnostics.length) process.exitCode = 1;
    return;
  }

  if (command === "info" || command === "status" || command === "stats" || !command) {
    const index = await readWorkspaceIndex(context);
    const tasks = listTasks(index, { archived: false });
    const groups = await listTaskGroups(context);
    const documents = listDocuments(index);
    const overview = {
      workspace: selected.root,
      source: selected.source,
      groups: groups.filter((group) => !group.archived).length,
      archivedGroups: groups.filter((group) => group.archived).length,
      tasks: tasks.length,
      statuses: Object.fromEntries(
        taskStatuses.map((status) => [
          status,
          tasks.filter((task) => task.metadata.status === status).length,
        ]),
      ),
      documents: documents.length,
      diagnostics: index.diagnostics.length,
    };
    if (json) output(overview);
    else {
      line(`${color("TASK", pc.bold)} · ${selected.root}`);
      line(
        `${overview.tasks} active tasks · ${overview.groups} groups · ${overview.documents} documents · ${overview.diagnostics} metadata issues`,
      );
      for (const group of groups.filter((item) => !item.archived))
        line(`  ${group.name}  ${group.completed}/${group.total} complete  (${group.path})`);
      if (overview.tasks === 0)
        line(
          'No tasks yet. Create a group and add a task with: task group create --title "My project"',
        );
    }
    return;
  }

  if (command === "tree") {
    const tree = await listWorkspaceTree(context);
    if (json) output(tree);
    else for (const path of tree) line(path);
    return;
  }

  if (command === "group") {
    const action = args.positionals[0];
    if (action === "list") {
      const groups = await listTaskGroups(context);
      if (json) output(groups);
      else
        for (const group of groups)
          line(
            `${group.id}  ${group.archived ? "archived" : "active"}  ${group.completed}/${group.total}  ${group.name}  ${group.path}`,
          );
      return;
    }
    if (action === "create") {
      let name = optionString(args, "title");
      if (!name && process.stdin.isTTY) name = await promptText("Group name");
      if (!name) throw new WorkspaceError("invalid_input", "Provide --title <name>");
      const group = await createTaskGroup(context, name);
      if (json) output(group);
      else line(`Created ${group.name} (${group.id}) at ${group.path}`);
      return;
    }
    throw new WorkspaceError("invalid_input", "Use: task group create|list");
  }

  if (command === "list") {
    const index = await readWorkspaceIndex(context);
    const limitText = optionString(args, "limit");
    const limit = limitText === undefined ? undefined : Number(limitText);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 0))
      throw new WorkspaceError("invalid_input", "--limit must be a non-negative integer");
    const tasks = listTasks(index, {
      archived: args.options.has("archived"),
      status: enumOption("status", taskStatuses),
      priority: enumOption("priority", taskPriorities),
      assignee: optionString(args, "assignee"),
      project: optionString(args, "project"),
      tag: optionString(args, "tag"),
      group: optionString(args, "group"),
    });
    const sort = optionString(args, "sort") ?? "name";
    if (!["name", "status", "priority", "updated", "due"].includes(sort))
      throw new WorkspaceError(
        "invalid_input",
        "--sort must be name, status, priority, updated, or due",
      );
    tasks.sort((a, b) => {
      const sortValue = (task: DocumentSummary): string => {
        if (sort === "status") return task.metadata.status ?? "";
        if (sort === "priority") return task.metadata.priority ?? "";
        if (sort === "due") return task.metadata.due_at ?? "";
        return task.metadata.name;
      };
      const key =
        sort === "updated" ? b.modifiedAt - a.modifiedAt : sortValue(a).localeCompare(sortValue(b));
      return key || a.metadata.name.localeCompare(b.metadata.name);
    });
    if (limit !== undefined) tasks.splice(limit);
    if (json) output(tasks.map(record));
    else tasks.forEach(printDocument);
    return;
  }

  if (command === "show" || (command === "docs" && args.positionals[0] === "show")) {
    const identifier = command === "docs" ? args.positionals[1] : args.positionals[0];
    if (!identifier) throw new WorkspaceError("invalid_input", "Provide a document ID or path");
    const result = await getDocument(context, identifier);
    if (json) output({ ...record(result.summary), body: result.body });
    else {
      printDocument(result.summary);
      line("");
      line(result.body);
    }
    return;
  }

  if (command === "search" || (command === "docs" && args.positionals[0] === "search")) {
    const query =
      command === "docs" ? args.positionals.slice(1).join(" ") : args.positionals.join(" ");
    if (!query) throw new WorkspaceError("invalid_input", "Provide search text");
    const searchIn = command === "docs" ? "docs" : (optionString(args, "in") ?? "all");
    if (!["tasks", "docs", "all"].includes(searchIn))
      throw new WorkspaceError("invalid_input", "--in must be tasks, docs, or all");
    const searchType = optionString(args, "type");
    if (searchType && !["task", "document"].includes(searchType))
      throw new WorkspaceError("invalid_input", "--type must be task or document");
    const limitText = optionString(args, "limit");
    const limit = limitText === undefined ? undefined : Number(limitText);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 0))
      throw new WorkspaceError("invalid_input", "--limit must be a non-negative integer");
    const matches = await searchWorkspace(context, query, {
      in: searchIn as "tasks" | "docs" | "all",
      type: searchType as "task" | "document" | undefined,
      limit,
    });
    if (json) output(matches.map(({ summary, snippet }) => ({ ...record(summary), snippet })));
    else
      matches.forEach(({ summary, snippet }) => {
        printDocument(summary);
        line(`  ${snippet}`);
      });
    return;
  }

  if (command === "create") {
    let title = optionString(args, "title");
    let group = optionString(args, "group");
    if (!title && process.stdin.isTTY) title = await promptText("Task title");
    if (!group && process.stdin.isTTY) {
      const groups = (await listTaskGroups(context)).filter((candidate) => !candidate.archived);
      if (groups.length) {
        const chosen = await select({
          message: "Choose a task group",
          options: groups.map((candidate) => ({ value: candidate.id, label: candidate.name })),
        });
        if (isCancel(chosen)) {
          cancel("Cancelled.");
          process.exit(130);
        }
        group = chosen;
      } else {
        const createGroup = await select({
          message: "There are no active task groups yet",
          options: [
            { value: "create", label: "Create a group now" },
            { value: "cancel", label: "Cancel" },
          ],
        });
        if (isCancel(createGroup) || createGroup === "cancel") {
          cancel("No task created.");
          process.exit(130);
        }
        const groupName = await promptText("New task group name");
        const createdGroup = await createTaskGroup(context, groupName);
        group = createdGroup.id;
      }
    }
    if (!title) throw new WorkspaceError("invalid_input", "Provide --title <name>");
    if (!group) throw new WorkspaceError("invalid_input", "Provide --group <group-id-or-slug>");
    const task = await createTask(context, {
      title,
      group,
      description: optionString(args, "description"),
      status: enumOption("status", taskStatuses),
      priority: enumOption("priority", taskPriorities),
      assignee: optionString(args, "assignee"),
      project: optionString(args, "project"),
      dueAt: optionString(args, "due"),
      tags: optionList(args, "tag"),
      dependsOn: optionList(args, "depends-on"),
      extra: extraOption(),
    });
    if (json) output(record(task));
    else {
      line(`Created ${task.metadata.id} · ${task.metadata.name}`);
      line(`  ${task.path}`);
    }
    return;
  }

  if (command === "update" || command === "edit") {
    const identifier = args.positionals[0];
    if (!identifier) throw new WorkspaceError("invalid_input", `Usage: task ${command} <task-id>`);
    const index = await readWorkspaceIndex(context);
    const task = findDocument(index, identifier);
    if (command === "edit") {
      const editor = process.env.EDITOR ?? process.env.VISUAL;
      if (!editor) throw new WorkspaceError("invalid_input", "Set EDITOR to edit a task");
      await editDocumentBody(context, task, editor);
      line(`Edited ${task.metadata.id} at ${task.path}`);
      return;
    }
    const title = optionString(args, "title");
    const status = enumOption("status", taskStatuses);
    const priority = enumOption("priority", taskPriorities);
    const assignee = optionString(args, "assignee");
    const project = optionString(args, "project");
    const dueAt = optionString(args, "due");
    const tags = args.options.has("tag") ? optionList(args, "tag") : undefined;
    const dependsOn = args.options.has("depends-on") ? optionList(args, "depends-on") : undefined;
    const extra = extraOption();
    if (
      ![title, status, priority, assignee, project, dueAt, tags, dependsOn, extra].some(
        (value) => value !== undefined,
      )
    )
      throw new WorkspaceError("invalid_input", "Provide at least one field to update");
    const result = await updateTask(context, identifier, {
      title,
      status,
      priority,
      assignee,
      project,
      dueAt,
      tags,
      dependsOn,
      extra,
    });
    if (json) output({ ...record(result.task), archivedGroup: result.archivedGroup });
    else {
      line(`Updated ${result.task.metadata.id} · ${result.task.metadata.name}`);
      if (result.archivedGroup) line(`Archived completed group to ${result.archivedGroup.path}`);
    }
    return;
  }

  if (command === "archive" || command === "restore") {
    const identifier = args.positionals[0];
    if (!identifier) throw new WorkspaceError("invalid_input", `Usage: task ${command} <group>`);
    const group =
      command === "archive"
        ? await archiveTaskGroup(context, identifier)
        : await restoreTaskGroup(context, identifier);
    if (json) output(group);
    else line(`${command === "archive" ? "Archived" : "Restored"} ${group.name} at ${group.path}`);
    return;
  }

  if (command === "validate") {
    const scope = (args.positionals[0] ?? "all") as
      | "all"
      | "tasks"
      | "docs"
      | "links"
      | "references";
    if (!["all", "tasks", "docs", "links", "references"].includes(scope))
      throw new WorkspaceError(
        "invalid_input",
        "Validation scope must be all, tasks, docs, links, or references",
      );
    const diagnostics = await validateWorkspace(context, scope);
    if (json) output({ valid: diagnostics.length === 0, diagnostics });
    else if (!diagnostics.length) line("Workspace is valid.");
    else
      for (const diagnostic of diagnostics) errorLine(`${diagnostic.path}: ${diagnostic.message}`);
    if (diagnostics.length) process.exitCode = 1;
    return;
  }

  if (command === "docs") {
    const action = args.positionals[0];
    if (action === "list") {
      const docs = listDocuments(await readWorkspaceIndex(context));
      if (json) output(docs.map(record));
      else docs.forEach(printDocument);
      return;
    }
    if (action === "tree") {
      const tree = await listWorkspaceTree(context);
      const docs = tree.filter((path) => !path.startsWith("todo/") && !path.startsWith("archive/"));
      if (json) output(docs);
      else for (const path of docs) line(path);
      return;
    }
    if (action === "open") {
      const identifier = args.positionals[1];
      if (!identifier) throw new WorkspaceError("invalid_input", "Provide a document ID or path");
      const summary = findDocument(await readWorkspaceIndex(context), identifier);
      const editor = process.env.EDITOR ?? process.env.VISUAL;
      if (!editor) throw new WorkspaceError("invalid_input", "Set EDITOR to open a document");
      await editDocumentBody(context, summary, editor);
      return;
    }
    if (action === "create") {
      const title = requiredOption("title");
      const path = requiredOption("path");
      const document = await createDocument(context, {
        title,
        path,
        body: optionString(args, "body"),
        tags: optionList(args, "tag"),
        extra: extraOption(),
      });
      if (json) output(record(document));
      else line(`Created ${document.metadata.id} · ${document.path}`);
      return;
    }
    throw new WorkspaceError("invalid_input", "Use task docs list|show|search|tree|open|create");
  }

  if (command === "index") {
    const action = args.positionals[0] ?? "status";
    const index = await readWorkspaceIndex(context);
    if (action === "status" || action === "rebuild") {
      const details = {
        documents: index.documents.size,
        invalid: index.diagnostics.length,
        scannedAt: new Date(index.scannedAt).toISOString(),
      };
      if (json) output(details);
      else
        line(
          `${action === "rebuild" ? "Rebuilt" : "Index"}: ${details.documents} documents, ${details.invalid} metadata issues`,
        );
      return;
    }
    if (action === "verify") {
      const diagnostics = await validateWorkspace(context);
      const result = {
        documents: index.documents.size,
        valid: diagnostics.length === 0,
        diagnostics,
      };
      if (json) output(result);
      else
        line(
          result.valid
            ? "Index and workspace verified."
            : `${diagnostics.length} validation issue(s).`,
        );
      if (!result.valid) process.exitCode = 1;
      return;
    }
    throw new WorkspaceError("invalid_input", "Use task index status|rebuild|verify");
  }

  throw new WorkspaceError("invalid_input", `Unknown command: ${command}. Run task --help.`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (json)
    console.error(
      JSON.stringify({ error: isWorkspaceError(error) ? error.code : "internal_error", message }),
    );
  else errorLine(`task: ${message}`);
  process.exitCode =
    error instanceof WorkspaceError && error.code === "workspace_not_found" ? 2 : 1;
}
