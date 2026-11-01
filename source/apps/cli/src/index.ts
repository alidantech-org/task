#!/usr/bin/env bun

import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { confirm, isCancel, multiselect, outro, select } from "@clack/prompts";
import type {
  DocumentSummary,
  QualityConfig,
  Recurrence,
  SetupSelection,
  TaskLink,
} from "@task/workspace";
import {
  addFileAttachment,
  addLinkAttachment,
  addTaskComment,
  applyProjectSetupPlan,
  archiveTask,
  archiveTaskGroup,
  buildActivity,
  bulkUpdateTasks,
  compareTasks,
  createDocument,
  createProjectSetupPlan,
  createTask,
  createTaskFromTemplate,
  createTaskGroup,
  createTemplate,
  deleteDocument,
  deleteTask,
  deleteTaskGroup,
  findDocument,
  getDocument,
  getTaskChanges,
  getTaskFileDiff,
  initializeWorkspace,
  inspectProject,
  isErrorDiagnostic,
  listDocuments,
  listTaskComments,
  listTaskGroups,
  listTasks,
  listTemplates,
  listTrash,
  listWorkspaceTree,
  migrateLegacyGroups,
  moveTask,
  parseRecurrence,
  readDocumentChecklist,
  readWorkspaceIndex,
  removeAttachment,
  reorderTask,
  replaceDocumentBody,
  resolveAuthor,
  resolveWorkspace,
  restoreFromTrash,
  restoreTask,
  restoreTaskGroup,
  searchWorkspace,
  setDocumentChecklist,
  updateTask,
  validateWorkspace,
  WorkspaceError,
  writeSelfDocumentation,
} from "@task/workspace";
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
import { renderDiagnostics } from "#/output/diagnostics";
import { renderDocument } from "#/output/documents";
import { emitError, emitJson, emitLine } from "#/output/emit";
import { renderMessage } from "#/output/message";
import { renderOverview } from "#/output/overview";
import { createStyle } from "#/output/style";
import { createSymbols } from "#/output/symbols";
import { renderTaskTable } from "#/output/table";
import { resolveTerminal } from "#/output/terminal";
import { isInteractive, promptText as promptTextInput } from "#/prompts/input";
import { workspaceMenu } from "#/prompts/menu";
import { resolveTuiEntry, runLocalDashboard } from "#/run";

const cliPackage = JSON.parse(
  await Bun.file(new URL("../package.json", import.meta.url)).text(),
) as {
  version: string;
};
const version = cliPackage.version;
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
const forcedPlain = args.options.has("plain") || args.options.has("no-color");
const capabilities = resolveTerminal({
  stdoutTTY: Boolean(process.stdout.isTTY),
  stderrTTY: Boolean(process.stderr.isTTY),
  env: {
    ...process.env,
    ...(forcedPlain ? { NO_COLOR: "1" } : {}),
  },
  stdoutEncoding: process.stdout.isTTY ? "utf-8" : undefined,
  stderrEncoding: process.stderr.isTTY ? "utf-8" : undefined,
  platform: process.platform,
});
const stdoutStyle = createStyle(capabilities.stdout);
const stderrStyle = createStyle(capabilities.stderr);
const stdoutSymbols = createSymbols(capabilities.stdout);
const stderrSymbols = createSymbols(capabilities.stderr);
const outputContext = { args, stdoutStyle, stderrStyle, stdoutSymbols, stderrSymbols };
const line = (value = "", kind: "routine" | "requested" = "routine"): void =>
  emitLine(outputContext, value, kind);
const errorLine = (value: string): void => emitError(outputContext, value, false);

function printHelp(): void {
  const rows = [
    "TASK · Your work, organised.",
    "Usage: task [command] [options]",
    "",
    "Commands:",
    "  (no command)           Workspace overview",
    "  init [--workspace <path>]  Initialize this project for Task and document it for agents",
    "  init --refresh-docs    Refresh the workspace guide and AGENTS.md block of an existing workspace",
    "  project inspect       Inspect repository and suggest guidance (read-only)",
    "  setup                 Review and apply project documentation and agent guidance",
    "  setup plan --json     Emit a reviewed setup plan without writing files",
    "  setup apply --path    Apply a saved JSON setup plan",
    "  tui | -f               Open the full-screen workspace interface",
    "  run                    Start the local dashboard and open it in a browser",
    "  doctor                 Check Bun and workspace health",
    "  info | status | stats  Workspace information and counts",
    "  tree                   Show Markdown workspace paths",
    "  group create|list      Manage task groups",
    "  migrate                Move legacy flat task groups into week folders",
    "  list [filters]         List active tasks (use --archived for archived)",
    "  show <id|path>         Show a task or document",
    "  search <query>         Search metadata and Markdown text",
    "  create                 Create a task in a group",
    "  update <id>            Update task metadata",
    "  edit <id>              Edit the Markdown body in $EDITOR",
    "  archive <task-or-group> Archive a task or group",
    "  restore <task-or-group> Restore an archived task or group",
    "  start <id> [--track]   Move a task to in-progress, optionally recording git changes",
    "  changes <id> [--diff <path>]  Show git changes made while the task was in progress",
    '  comment <id> --text "…"   Add a comment; comments <id> lists them',
    "  move <id> (--before|--after <id> | --order N | --group <id>)  Reorder or move a task",
    "  attach <id> <file|url> / detach <id> <name>  Manage small attachments and links",
    "  template create|list   Reusable task templates (use with create --template <id>)",
    "  bulk <id…> [--status …]  Change many tasks; activity <id> shows the timeline",
    "  checklist <id>         Show a task's checkboxes grouped by heading",
    '  check|uncheck <id> (--item N | --section "Heading" | --all)  Tick checkboxes without editing the file',
    "  delete <id> [--yes] [--force] [--cascade]  Move a task, group or document to the temp trash",
    "  undelete <trash-id>    Restore a deleted item from the trash",
    "  trash list             List items that can be undeleted",
    "  validate [scope]       Validate tasks, docs, links, and references",
    "  docs list|show|search|tree|open|create",
    "  index status|rebuild|verify",
    "",
    "Setup options: --docs project-overview,repository-map,development-setup,testing-guide --rules coding,testing,security,git --agents codex,claude,copilot,cursor,skill",
    "Options: --workspace <path> --no-open --json --plain --no-color --quiet --verbose -f/--full-screen --help --version",
    "Task fields: --title --group --status --priority --assignee --project --tag a,b --due YYYY-MM-DD --depends-on TSK-… --extra JSON",
  ];
  for (const row of rows) line(row, "requested");
}

function output(value: unknown): void {
  emitJson(value);
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
    order: summary.metadata.order,
    parent: summary.metadata.parent,
    estimate: summary.metadata.estimate,
    links: summary.metadata.links,
    watchers: summary.metadata.watchers,
    recurrence: summary.metadata.recurrence,
    attachments: summary.metadata.attachments?.length,
    path: summary.path,
    modifiedAt: new Date(summary.modifiedAt).toISOString(),
  };
}

function printDocument(summary: DocumentSummary): void {
  for (const rendered of renderDocument(
    summary,
    stdoutStyle,
    stdoutSymbols,
    args.options.has("verbose"),
  ))
    line(rendered, "requested");
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

function numberOption(key: string): number | null | undefined {
  const value = optionString(args, key);
  if (value === undefined) return undefined;
  if (value === "none") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new WorkspaceError("invalid_input", `--${key} must be a number or none`);
  return parsed;
}

function linkOption(): TaskLink[] | undefined {
  if (!args.options.has("link")) return undefined;
  const values = optionList(args, "link");
  if (values.length === 1 && values[0] === "none") return [];
  return values.map((value) => {
    const [type, task] = value.split(":");
    if ((type !== "blocks" && type !== "relates" && type !== "duplicates") || !task)
      throw new WorkspaceError(
        "invalid_input",
        "--link must look like blocks:TSK-… (blocks, relates or duplicates)",
      );
    return { type, task };
  });
}

function repeatOption(): Recurrence | null | undefined {
  const value = optionString(args, "repeat");
  if (value === undefined) return undefined;
  if (value === "none") return null;
  try {
    return parseRecurrence(value);
  } catch (error) {
    throw new WorkspaceError(
      "invalid_input",
      error instanceof Error ? error.message : "Invalid --repeat",
    );
  }
}

async function readTextInput(source: string): Promise<string> {
  const text = source === "-" ? await Bun.stdin.text() : await Bun.file(source).text();
  if (text.length > 1_000_000) throw new WorkspaceError("invalid_input", `${source} is too large`);
  return text;
}

async function optionalTextFile(option: string): Promise<string | undefined> {
  const source = optionString(args, option);
  return source === undefined ? undefined : readTextInput(source);
}

function printWarnings(warnings: readonly string[] | undefined): void {
  for (const warning of warnings ?? [])
    emitError(outputContext, `${stderrSymbols.warning} ${warning}`, false);
}

async function promptText(message: string, placeholder?: string): Promise<string> {
  if (!isInteractive())
    throw new WorkspaceError(
      "invalid_input",
      `Non-interactive use requires ${placeholder ? `--${placeholder}` : "explicit arguments"}`,
    );
  return promptTextInput(message, placeholder);
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

async function selectSetupItems<T extends string>(
  message: string,
  options: readonly { value: T; label: string; hint?: string }[],
): Promise<T[]> {
  const result = await multiselect<string>({
    message,
    options: options.map(({ value, label, hint }) => ({ value, label, hint })),
  });
  if (isCancel(result)) {
    emitError(outputContext, "Cancelled · no files changed", false);
    process.exit(130);
  }
  return result as T[];
}

async function runInteractiveSetup(context: { root: string; projectRoot: string }): Promise<void> {
  const inspection = await inspectProject(context.projectRoot);
  for (const fact of inspection.facts) {
    const evidence = fact.evidence.slice(0, 4);
    const more =
      fact.evidence.length > evidence.length
        ? `, +${fact.evidence.length - evidence.length} more`
        : "";
    line(
      `${stdoutStyle.accent(fact.key)}  ${fact.value}${evidence.length ? `  ${stdoutStyle.muted(`${evidence.join(", ")}${more}`)}` : ""}`,
      "requested",
    );
  }
  if (inspection.findings.length) {
    line("\nSuggested additions:", "requested");
    for (const finding of inspection.findings)
      line(`  · ${finding.title} — ${finding.reason}`, "requested");
  }
  const documentation = await selectSetupItems("Choose Task workspace documents", [
    { value: "project-overview", label: "Project overview", hint: "Verified repository facts" },
    {
      value: "repository-map",
      label: "Repository map",
      hint: "Detected source and tooling layout",
    },
    {
      value: "development-setup",
      label: "Development setup",
      hint: "Manifests, lockfiles, declared scripts",
    },
    { value: "testing-guide", label: "Testing guide", hint: "Detected tests and declared scripts" },
  ]);
  const rules = await selectSetupItems("Choose project rules", [
    { value: "coding", label: "Coding and collaboration" },
    { value: "testing", label: "Testing and verification" },
    { value: "security", label: "Security boundaries" },
    { value: "git", label: "Git behavior", hint: "Guidance only; no git config/hooks" },
  ]);
  const agents = await selectSetupItems("Choose agent adapters", [
    { value: "codex", label: "Codex / AGENTS.md" },
    { value: "claude", label: "Claude Code / CLAUDE.md" },
    { value: "copilot", label: "GitHub Copilot instructions" },
    { value: "cursor", label: "Cursor rule (.mdc)" },
    { value: "skill", label: "Portable Agent Skill" },
  ]);
  const gitGuidance = rules.includes("git")
    ? await promptText(
        "Describe the Git behavior agents should follow",
        "existing branch, commit, and review conventions",
      )
    : undefined;
  const plan = await createProjectSetupPlan(context, { documentation, rules, agents, gitGuidance });
  if (!plan.changes.length) {
    line("Nothing selected; no files changed.", "requested");
    return;
  }
  line("\nReview plan:", "requested");
  for (const change of plan.changes) {
    line(`\n${stdoutStyle.accent(change.path)} · ${change.purpose}`, "requested");
    line(
      change.content
        .split("\n")
        .slice(0, 8)
        .map((row) => `  ${row}`)
        .join("\n"),
      "requested",
    );
    if (change.content.split("\n").length > 8) line("  …", "requested");
  }
  const accepted = await confirm({ message: `Apply ${plan.changes.length} reviewed change(s)?` });
  if (isCancel(accepted) || !accepted) {
    outro("No files changed.");
    return;
  }
  const result = await applyProjectSetupPlan(plan);
  for (const path of result.written) line(`${stdoutSymbols.success} ${path}`, "requested");
  for (const path of result.conflicts)
    line(`${stdoutSymbols.warning} Skipped existing unmarked file ${path}`, "requested");
}

async function main(): Promise<void> {
  if (args.options.has("help") || args.command === "help") return printHelp();
  if (args.options.has("version") || args.command === "version")
    return line(`task ${metadata.version}`);
  if (args.command === "init") {
    const refreshDocs = args.options.has("refresh-docs");
    let projectRoot: string;
    let workspaceRoot: string;
    let createdWorkspace = false;
    let existingQuality: QualityConfig | undefined;
    if (refreshDocs) {
      const existing = await resolveWorkspace({
        workspaceOverride: optionString(args, "workspace"),
        environmentWorkspaceRoot: process.env.TASK_WORKSPACE_ROOT,
      });
      projectRoot = existing.projectRoot;
      workspaceRoot = existing.root;
      existingQuality = existing.config.quality;
    } else {
      const initialized = await initializeWorkspace({
        projectRoot: process.cwd(),
        workspace: optionString(args, "workspace") ?? "tasks",
      });
      projectRoot = initialized.projectRoot;
      workspaceRoot = initialized.root;
      createdWorkspace = initialized.createdWorkspace;
    }
    const documentation = await writeSelfDocumentation({
      projectRoot,
      workspaceRoot,
      quality: existingQuality,
    });
    const result = {
      workspace: workspaceRoot,
      config: join(projectRoot, "task.yaml"),
      createdWorkspace,
      documentation,
    };
    if (json) output(result);
    else {
      line(
        renderMessage(
          "success",
          `${refreshDocs ? "Refreshed Task documentation" : "Initialized Task workspace"} · ${workspaceRoot}`,
          stdoutStyle,
          stdoutSymbols,
        ),
        "requested",
      );
      if (!refreshDocs) line(`  ${stdoutStyle.muted("task.yaml")}`, "requested");
      for (const path of documentation.written)
        line(`  ${stdoutStyle.muted(`wrote ${path}`)}`, "requested");
      for (const path of documentation.skipped)
        line(`  ${stdoutStyle.muted(`kept existing ${path}`)}`, "requested");
      if (!refreshDocs) line('  Start with: task group create --title "My project"', "requested");
    }
    return;
  }
  if (args.command === "project" && args.positionals[0] === "inspect") {
    const inspection = await inspectProject(process.cwd());
    if (json) output(inspection);
    else {
      line(`Project · ${inspection.projectRoot}`, "requested");
      line("\nDetected facts", "requested");
      for (const fact of inspection.facts)
        line(
          `  ${fact.key.padEnd(18)} ${fact.value}${fact.evidence.length ? ` · ${stdoutStyle.muted(`${fact.evidence.slice(0, 4).join(", ")}${fact.evidence.length > 4 ? `, +${fact.evidence.length - 4} more` : ""}`)}` : ""}`,
          "requested",
        );
      line("\nSuggestions", "requested");
      if (!inspection.findings.length) line("  No additional guidance suggestions.", "requested");
      for (const finding of inspection.findings)
        line(`  ${finding.title} · ${finding.reason}`, "requested");
    }
    return;
  }
  const workspaceOverride = optionString(args, "workspace");
  const selected = await resolveWorkspace({
    workspaceOverride,
    environmentWorkspaceRoot: process.env.TASK_WORKSPACE_ROOT,
  });
  const context = {
    root: selected.root,
    config: selected.config,
    projectRoot:
      resolve(selected.root) === resolve(process.cwd()) ? selected.root : selected.projectRoot,
  };
  const command = args.command;

  if (command === "run") {
    if (json)
      throw new WorkspaceError(
        "invalid_input",
        "`task run` starts interactive services and cannot use --json",
      );
    if (args.positionals.length)
      throw new WorkspaceError("invalid_input", "Use `task run [--no-open]`");
    await runLocalDashboard(
      {
        projectRoot: context.projectRoot,
        workspaceRoot: context.root,
        openBrowser: !args.options.has("no-open"),
        onMessage: (message) => line(message, "requested"),
      },
      import.meta.dir,
    );
    return;
  }

  if (command === "setup") {
    const action = args.positionals[0];
    if (action === "apply") {
      const planPath = requiredOption("path");
      const plan = JSON.parse(
        await Bun.file(resolve(planPath)).text(),
      ) as import("@task/workspace").ProjectSetupPlan;
      if (
        plan.projectRoot !== resolve(selected.projectRoot) ||
        plan.workspaceRoot !== resolve(selected.root)
      )
        throw new WorkspaceError(
          "invalid_input",
          "Setup plan project/workspace does not match the selected workspace",
        );
      const result = await applyProjectSetupPlan(plan);
      if (json) output(result);
      else {
        for (const path of result.written) line(`${stdoutSymbols.success} ${path}`, "requested");
        for (const path of result.conflicts)
          line(`${stdoutSymbols.warning} Skipped existing unmarked file ${path}`, "requested");
      }
      if (result.conflicts.length) process.exitCode = 2;
      return;
    }
    if (action && action !== "plan")
      throw new WorkspaceError("invalid_input", "Use task setup [plan|apply --path <file>]");
    if (isInteractive() && !json && action !== "plan") return runInteractiveSetup(context);
    const selection: SetupSelection = {
      documentation: optionList(args, "docs"),
      rules: optionList(args, "rules"),
      agents: optionList(args, "agents"),
    };
    const plan = await createProjectSetupPlan(context, selection);
    output(plan);
    return;
  }

  if (args.options.has("full-screen") || command === "tui") {
    if (command && command !== "tui")
      throw new WorkspaceError(
        "invalid_input",
        "Use `task -f` or `task tui` without another command",
      );
    if (json)
      throw new WorkspaceError(
        "invalid_input",
        "The full-screen TUI cannot be combined with --json",
      );
    if (!isInteractive())
      throw new WorkspaceError(
        "invalid_input",
        "The full-screen TUI requires an interactive terminal",
      );
    const tuiEntry = resolveTuiEntry();
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [tuiEntry], {
        cwd: selected.projectRoot,
        env: { ...process.env, TASK_WORKSPACE_ROOT: selected.root },
        stdio: "inherit",
      });
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        process.exitCode = signal ? 130 : (code ?? 1);
        resolve();
      });
    });
    return;
  }

  if (!command && !json && !args.options.has("quiet") && isInteractive()) {
    const action = await workspaceMenu(selected.root);
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
    outputContext.args = args;
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
      line(
        `${compatible ? stdoutSymbols.success : stdoutSymbols.error} Bun ${Bun.version}`,
        "requested",
      );
      line(`${stdoutSymbols.success} Workspace ${selected.root}`, "requested");
      line(
        `${index.diagnostics.length ? stdoutSymbols.warning : stdoutSymbols.success} ${index.documents.size} documents · ${index.diagnostics.length} metadata diagnostics`,
        "requested",
      );
      if (!args.options.has("quiet"))
        outro(compatible ? "Environment check complete." : "Upgrade Bun to 1.3.14 or later.");
    }
    if (!compatible || index.diagnostics.length) process.exitCode = 1;
    return;
  }

  if (command === "info" || command === "status" || command === "stats" || !command) {
    if (!command && args.options.has("quiet") && !json) return;
    const index = await readWorkspaceIndex(context);
    const tasks = listTasks(index, { archived: false });
    const completedTasks = listTasks(index, { archived: false, status: "completed" });
    const groups = await listTaskGroups(context);
    const documents = listDocuments(index);
    const overview = {
      workspace: selected.root,
      source: selected.source,
      groups: groups.filter((group) => !group.archived && !group.finished).length,
      completedGroups: groups.filter((group) => group.finished).length,
      archivedGroups: groups.filter((group) => group.archived).length,
      tasks: tasks.length,
      statuses: Object.fromEntries(
        taskStatuses.map((status) => [
          status,
          (status === "completed" ? completedTasks : tasks).filter(
            (task) => task.metadata.status === status,
          ).length,
        ]),
      ),
      documents: documents.length,
      diagnostics: index.diagnostics.length,
    };
    if (json) output(overview);
    else {
      for (const row of renderOverview(overview, groups, stdoutStyle, stdoutSymbols))
        line(row, args.options.has("quiet") ? "routine" : "requested");
    }
    return;
  }

  if (command === "tree") {
    const tree = await listWorkspaceTree(context);
    if (json) output(tree);
    else for (const path of tree) line(path);
    return;
  }

  if (command === "migrate") {
    const groups = await migrateLegacyGroups(context);
    if (json) output({ migrated: groups.length, groups });
    else
      line(
        renderMessage(
          "success",
          `Organized ${groups.length} legacy group(s).`,
          stdoutStyle,
          stdoutSymbols,
        ),
        "requested",
      );
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
            `${stdoutSymbols.group} ${stdoutStyle.accent(group.id)}  ${group.archived ? "archived" : group.finished ? "completed" : "active"}  ${group.completed}/${group.total} done  ${group.name}  ${stdoutStyle.muted(group.path)}`,
            "requested",
          );
      return;
    }
    if (action === "create") {
      let name = optionString(args, "title");
      if (!name && isInteractive()) name = await promptText("Group name", "title");
      if (!name) throw new WorkspaceError("invalid_input", "Provide --title <name>");
      const group = await createTaskGroup(context, name, {
        goal: await optionalTextFile("goal-file"),
        plan: await optionalTextFile("plan-file"),
      });
      if (json) output(group);
      else
        line(
          renderMessage(
            "success",
            `Created group ${group.name} (${group.id}) · ${group.path}`,
            stdoutStyle,
            stdoutSymbols,
          ),
        );
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
    const sort = optionString(args, "sort") ?? "order";
    if (!["order", "name", "status", "priority", "updated", "due"].includes(sort))
      throw new WorkspaceError(
        "invalid_input",
        "--sort must be order, name, status, priority, updated, or due",
      );
    const me =
      args.options.has("mine") || args.options.has("watching") ? await resolveAuthor(context) : "";
    const parentFilter = optionString(args, "parent");
    const selected = tasks.filter(
      (task) =>
        (!args.options.has("mine") || task.metadata.assignee?.toLowerCase() === me.toLowerCase()) &&
        (!args.options.has("watching") ||
          (task.metadata.watchers ?? []).some((name) => name.toLowerCase() === me.toLowerCase())) &&
        (parentFilter === undefined || task.metadata.parent === parentFilter),
    );
    tasks.splice(0, tasks.length, ...selected);
    tasks.sort((a, b) => {
      const sortValue = (task: DocumentSummary): string => {
        if (sort === "status") return task.metadata.status ?? "";
        if (sort === "priority") return task.metadata.priority ?? "";
        if (sort === "due") return task.metadata.due_at ?? "";
        return task.metadata.name;
      };
      const key =
        sort === "order"
          ? compareTasks(a, b)
          : sort === "updated"
            ? b.modifiedAt - a.modifiedAt
            : sortValue(a).localeCompare(sortValue(b));
      return key || a.metadata.name.localeCompare(b.metadata.name);
    });
    if (limit !== undefined) tasks.splice(limit);
    if (json) output(tasks.map(record));
    else {
      const rows = renderTaskTable(
        tasks.map((task) => ({
          id: task.metadata.id,
          name: task.metadata.name,
          status: task.metadata.status,
          priority: task.metadata.priority,
          assignee: task.metadata.assignee,
          due: task.metadata.due_at,
        })),
        {
          width: process.stdout.columns ?? 80,
          symbols: stdoutSymbols,
          style: stdoutStyle,
          env: process.env,
        },
      );
      for (const row of rows) line(row, "requested");
    }
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
      line(result.body, "requested");
      if (args.options.has("verbose"))
        line(`\nMetadata: ${JSON.stringify(result.summary.metadata, null, 2)}`, "requested");
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
      matches.forEach(({ summary, snippet }, index) => {
        if (index) line("", "requested");
        printDocument(summary);
        line(`  ${stdoutStyle.muted(snippet)}`, "requested");
      });
    return;
  }

  if (command === "create") {
    let title = optionString(args, "title");
    let group = optionString(args, "group");
    if (!title && isInteractive()) title = await promptText("Task title", "title");
    if (!group && isInteractive()) {
      const groups = (await listTaskGroups(context)).filter(
        (candidate) => !candidate.archived && !candidate.finished,
      );
      if (groups.length) {
        const chosen = await select({
          message: "Choose a task group",
          options: groups.map((candidate) => ({ value: candidate.id, label: candidate.name })),
        });
        if (isCancel(chosen)) {
          emitError(outputContext, "Cancelled", false);
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
          emitError(outputContext, "Cancelled", false);
          process.exit(130);
        }
        const groupName = await promptText("New task group name");
        const createdGroup = await createTaskGroup(context, groupName);
        group = createdGroup.id;
      }
    }
    if (!title) throw new WorkspaceError("invalid_input", "Provide --title <name>");
    if (!group) throw new WorkspaceError("invalid_input", "Provide --group <group-id-or-slug>");
    const create = args.options.has("template")
      ? (input: Parameters<typeof createTask>[1]) =>
          createTaskFromTemplate(context, optionString(args, "template") ?? "", input)
      : (input: Parameters<typeof createTask>[1]) => createTask(context, input);
    const task = await create({
      title,
      group,
      description: optionString(args, "description"),
      body: await optionalTextFile("body-file"),
      status: enumOption("status", taskStatuses),
      priority: enumOption("priority", taskPriorities),
      assignee: optionString(args, "assignee"),
      project: optionString(args, "project"),
      dueAt: optionString(args, "due"),
      tags: optionList(args, "tag"),
      dependsOn: optionList(args, "depends-on"),
      startAt: optionString(args, "start"),
      order: numberOption("order") ?? undefined,
      estimate: numberOption("estimate") ?? undefined,
      parent: optionString(args, "parent"),
      links: linkOption(),
      watchers: args.options.has("add-watcher") ? optionList(args, "add-watcher") : undefined,
      recurrence: repeatOption() ?? undefined,
      extra: extraOption(),
    });
    if (json) output(record(task));
    else {
      line(
        renderMessage(
          "success",
          `Created ${task.metadata.id} · ${task.metadata.name}`,
          stdoutStyle,
          stdoutSymbols,
        ),
      );
      line(`  ${stdoutStyle.muted(task.path)}`);
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
    const track = args.options.has("track") ? true : undefined;
    const startAt = optionString(args, "start");
    const order = numberOption("order");
    const estimate = numberOption("estimate");
    const parentOption = optionString(args, "parent");
    const parent =
      parentOption === undefined ? undefined : parentOption === "none" ? null : parentOption;
    const links = linkOption();
    const recurrence = repeatOption();
    const watch = args.options.has("add-watcher") ? optionList(args, "add-watcher") : [];
    const unwatch = args.options.has("remove-watcher") ? optionList(args, "remove-watcher") : [];
    const watchers =
      watch.length || unwatch.length
        ? [...new Set([...(task.metadata.watchers ?? []), ...watch])].filter(
            (name) => !unwatch.includes(name),
          )
        : undefined;
    const group = optionString(args, "group");
    if (
      ![
        title,
        status,
        priority,
        assignee,
        project,
        dueAt,
        tags,
        dependsOn,
        extra,
        track,
        startAt,
        order,
        estimate,
        parent,
        links,
        recurrence,
        watchers,
        group,
      ].some((value) => value !== undefined)
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
      track,
      startAt,
      order,
      estimate,
      parent,
      links,
      recurrence,
      watchers,
    });
    if (group) result.task = await moveTask(context, identifier, group);
    printWarnings(result.warnings);
    if (json) output({ ...record(result.task), warnings: result.warnings });
    else {
      line(
        renderMessage(
          "success",
          `Updated ${result.task.metadata.id} · ${result.task.metadata.name}`,
          stdoutStyle,
          stdoutSymbols,
        ),
      );
    }
    return;
  }

  if (command === "archive" || command === "restore") {
    const identifier = args.positionals[0];
    if (!identifier)
      throw new WorkspaceError("invalid_input", `Usage: task ${command} <task-or-group>`);
    const isTask = identifier.startsWith("TSK-");
    const result =
      command === "archive"
        ? isTask
          ? await archiveTask(context, identifier)
          : await archiveTaskGroup(context, identifier)
        : isTask
          ? await restoreTask(context, identifier)
          : await restoreTaskGroup(context, identifier);
    if (json) output(result);
    else
      line(
        renderMessage(
          "success",
          `${command === "archive" ? "Archived" : "Restored"} ${"name" in result ? result.name : result.metadata.name} · ${result.path}`,
          stdoutStyle,
          stdoutSymbols,
        ),
      );
    return;
  }

  if (command === "start") {
    const identifier = args.positionals[0];
    if (!identifier)
      throw new WorkspaceError("invalid_input", "Usage: task start <task-id> [--track]");
    const result = await updateTask(context, identifier, {
      status: "in-progress",
      track: args.options.has("track"),
    });
    printWarnings(result.warnings);
    if (json) output({ ...record(result.task), warnings: result.warnings });
    else
      line(
        renderMessage(
          "success",
          `Started ${result.task.metadata.id} · ${result.task.metadata.name}${args.options.has("track") ? " · tracking git changes" : ""}`,
          stdoutStyle,
          stdoutSymbols,
        ),
        "requested",
      );
    return;
  }

  if (command === "changes") {
    const identifier = args.positionals[0];
    if (!identifier)
      throw new WorkspaceError("invalid_input", "Usage: task changes <task-id> [--diff <path>]");
    const task = findDocument(await readWorkspaceIndex(context), identifier);
    const segments = task.metadata.extra?.tracking?.segments ?? [];
    if (!segments.length)
      throw new WorkspaceError(
        "not_found",
        `${task.metadata.id} has no tracked changes; use task start ${task.metadata.id} --track`,
      );
    const diffPath = optionString(args, "diff");
    if (diffPath !== undefined) {
      const segmentOption = optionString(args, "segment");
      const result = await getTaskFileDiff(
        context,
        segments,
        segmentOption === undefined ? segments.length - 1 : Number(segmentOption),
        diffPath,
      );
      if (json) output(result);
      else process.stdout.write(result.diff);
      return;
    }
    const changes = await getTaskChanges(context, segments);
    if (json) output(changes);
    else if (!changes.available) line(`Tracking unavailable: ${changes.reason}`, "requested");
    else {
      const statusLetter = {
        added: "A",
        modified: "M",
        deleted: "D",
        renamed: "R",
        copied: "C",
        other: "?",
      };
      for (const file of changes.files)
        line(
          `${statusLetter[file.status]}  ${file.path}${file.denied ? " (contents hidden)" : ""}  +${file.insertions} -${file.deletions}`,
          "requested",
        );
      line(
        `${changes.totals.files} file(s) · +${changes.totals.insertions} -${changes.totals.deletions} · ${Math.round(changes.durationMs / 60000)} min in progress${changes.segments.some((segment) => segment.live) ? " · live" : ""}`,
        "requested",
      );
      for (const [name, summary] of Object.entries(changes.byDirectory))
        line(
          `  ${name}: ${summary.files} file(s) +${summary.insertions} -${summary.deletions}`,
          "requested",
        );
    }
    return;
  }

  if (command === "comment" || command === "comments") {
    const identifier = args.positionals[0];
    if (!identifier)
      throw new WorkspaceError("invalid_input", `Usage: task ${command} <task-id> [--text "…"]`);
    if (command === "comment") {
      const text = optionString(args, "text") ?? (await optionalTextFile("body-file"));
      if (!text)
        throw new WorkspaceError("invalid_input", 'Provide --text "…" or --body-file <path|->');
      const result = await addTaskComment(context, identifier, text);
      const added = result.comments.at(-1);
      if (json) output({ id: identifier, comment: added, total: result.comments.length });
      else
        line(
          renderMessage(
            "success",
            `Comment added by ${added?.author ?? "unknown"} · ${result.comments.length} total`,
            stdoutStyle,
            stdoutSymbols,
          ),
          "requested",
        );
      return;
    }
    const comments = await listTaskComments(context, identifier);
    if (json) output(comments.map(({ start: _start, end: _end, ...rest }) => rest));
    else if (!comments.length) line("No comments", "requested");
    else
      for (const comment of comments)
        line(
          `${comment.index + 1}. ${comment.at} ${comment.author ?? ""}\n   ${comment.text.replace(/\n/g, "\n   ")}`,
          "requested",
        );
    return;
  }

  if (command === "move") {
    const identifier = args.positionals[0];
    if (!identifier)
      throw new WorkspaceError(
        "invalid_input",
        "Usage: task move <task-id> (--before|--after <task-id> | --order N | --group <id>)",
      );
    const group = optionString(args, "group");
    let task: DocumentSummary | undefined;
    if (group) task = await moveTask(context, identifier, group);
    const before = optionString(args, "before");
    const after = optionString(args, "after");
    const order = numberOption("order");
    if (before !== undefined || after !== undefined || (order !== undefined && order !== null))
      task = await reorderTask(context, identifier, {
        ...(before !== undefined ? { before } : {}),
        ...(after !== undefined ? { after } : {}),
        ...(order !== undefined && order !== null ? { order } : {}),
      });
    if (!task)
      throw new WorkspaceError("invalid_input", "Provide --before, --after, --order or --group");
    if (json) output(record(task));
    else
      line(
        renderMessage(
          "success",
          `Moved ${task.metadata.id} · ${task.path}`,
          stdoutStyle,
          stdoutSymbols,
        ),
        "requested",
      );
    return;
  }

  if (command === "attach" || command === "detach") {
    const identifier = args.positionals[0];
    const target = args.positionals[1];
    if (!identifier || !target)
      throw new WorkspaceError(
        "invalid_input",
        `Usage: task ${command} <task-id> <${command === "attach" ? "file-or-url" : "name"}>`,
      );
    const author = await resolveAuthor(context);
    let task: DocumentSummary;
    if (command === "detach") task = await removeAttachment(context, identifier, target);
    else if (/^https?:\/\//i.test(target))
      task = await addLinkAttachment(
        context,
        identifier,
        { url: target, name: optionString(args, "name") },
        author,
      );
    else {
      const file = Bun.file(target);
      if (!(await file.exists())) throw new WorkspaceError("not_found", `No file at ${target}`);
      task = await addFileAttachment(
        context,
        identifier,
        {
          name: optionString(args, "name") ?? target,
          data: new Uint8Array(await file.arrayBuffer()),
        },
        author,
      );
    }
    if (json) output({ id: task.metadata.id, attachments: task.metadata.attachments ?? [] });
    else
      line(
        renderMessage(
          "success",
          `${task.metadata.attachments?.length ?? 0} attachment(s) on ${task.metadata.id}`,
          stdoutStyle,
          stdoutSymbols,
        ),
        "requested",
      );
    return;
  }

  if (command === "template") {
    const action = args.positionals[0];
    if (action === "list") {
      const templates = await listTemplates(context);
      if (json) output(templates);
      else if (!templates.length) line("No templates", "requested");
      else
        for (const template of templates)
          line(`${template.id}  ${template.name}  ${template.path}`, "requested");
      return;
    }
    if (action === "create") {
      const name = optionString(args, "title");
      const body = await optionalTextFile("body-file");
      if (!name || !body)
        throw new WorkspaceError(
          "invalid_input",
          "Usage: task template create --title <name> --body-file <path|->",
        );
      const priority = enumOption("priority", taskPriorities);
      const estimate = numberOption("estimate");
      const recurrence = repeatOption();
      const template = await createTemplate(context, {
        name,
        body,
        defaults: {
          ...(priority ? { priority } : {}),
          ...(args.options.has("tag") ? { tags: optionList(args, "tag") } : {}),
          ...(estimate !== undefined && estimate !== null ? { estimate } : {}),
          ...(args.options.has("add-watcher") ? { watchers: optionList(args, "add-watcher") } : {}),
          ...(recurrence ? { recurrence } : {}),
        },
      });
      if (json) output(template);
      else
        line(
          renderMessage(
            "success",
            `Created template ${template.id} · ${template.path}`,
            stdoutStyle,
            stdoutSymbols,
          ),
          "requested",
        );
      return;
    }
    throw new WorkspaceError("invalid_input", "Use: task template create|list");
  }

  if (command === "bulk") {
    const ids = args.positionals;
    if (ids.length === 0)
      throw new WorkspaceError(
        "invalid_input",
        "Usage: task bulk <task-id…> [--status … --priority … --assignee … --group … --archive]",
      );
    const results = await bulkUpdateTasks(context, ids, {
      status: enumOption("status", taskStatuses),
      priority: enumOption("priority", taskPriorities),
      assignee: optionString(args, "assignee"),
      tags: args.options.has("tag") ? optionList(args, "tag") : undefined,
      group: optionString(args, "group"),
      archive: args.options.has("archive") ? true : undefined,
    });
    if (json) output(results);
    else
      for (const result of results)
        line(
          `${result.ok ? stdoutSymbols.success : stdoutSymbols.warning} ${result.id}${result.error ? `  ${result.error}` : ""}`,
          "requested",
        );
    if (results.some((result) => !result.ok)) process.exitCode = 1;
    return;
  }

  if (command === "activity") {
    const identifier = args.positionals[0];
    if (!identifier) throw new WorkspaceError("invalid_input", "Usage: task activity <task-id>");
    const task = findDocument(await readWorkspaceIndex(context), identifier);
    const timeline = buildActivity(task.metadata, await listTaskComments(context, identifier));
    if (json) output(timeline);
    else
      for (const entry of timeline)
        line(
          `${entry.at}  ${entry.kind.padEnd(10)} ${entry.text}${entry.author ? ` — ${entry.author}` : ""}`,
          "requested",
        );
    return;
  }

  if (command === "checklist") {
    const identifier = args.positionals[0];
    if (!identifier) throw new WorkspaceError("invalid_input", "Usage: task checklist <id>");
    const { document, checklist } = await readDocumentChecklist(context, identifier);
    if (json) output({ id: document.metadata.id, contentHash: document.contentHash, ...checklist });
    else {
      line(
        `${document.metadata.name} · ${checklist.completed}/${checklist.total} done`,
        "requested",
      );
      for (const group of checklist.groups) {
        line(`${group.heading || "(no heading)"}`, "requested");
        for (const item of group.items)
          line(`  ${item.index + 1}. [${item.checked ? "x" : " "}] ${item.text}`, "requested");
      }
    }
    return;
  }

  if (command === "check" || command === "uncheck") {
    const identifier = args.positionals[0];
    const usage = `Usage: task ${command} <id> (--item N[,N] | --section "Heading" | --all)`;
    if (!identifier) throw new WorkspaceError("invalid_input", usage);
    const itemOption = optionString(args, "item");
    const section = optionString(args, "section");
    const all = args.options.has("all");
    if ([itemOption !== undefined, section !== undefined, all].filter(Boolean).length !== 1)
      throw new WorkspaceError("invalid_input", usage);
    const items = itemOption?.split(",").map((value) => Number(value.trim()) - 1);
    if (items?.some((value) => !Number.isInteger(value) || value < 0))
      throw new WorkspaceError("invalid_input", "--item takes 1-based item numbers");
    const result = await setDocumentChecklist(
      context,
      identifier,
      {
        ...(items ? { items } : {}),
        ...(section !== undefined ? { section } : {}),
        ...(all ? { all } : {}),
      },
      command === "check",
    );
    const progress = (await readDocumentChecklist(context, identifier)).checklist;
    if (json)
      output({
        id: result.document.metadata.id,
        changed: result.changed,
        completed: progress.completed,
        total: progress.total,
      });
    else
      line(
        renderMessage(
          "success",
          `${result.changed} item(s) ${command === "check" ? "checked" : "unchecked"} · ${progress.completed}/${progress.total} done`,
          stdoutStyle,
          stdoutSymbols,
        ),
        "requested",
      );
    return;
  }

  if (command === "delete") {
    const identifier = args.positionals[0];
    if (!identifier) throw new WorkspaceError("invalid_input", "Usage: task delete <id>");
    if (!args.options.has("yes")) {
      if (json || !process.stdin.isTTY || !process.stdout.isTTY)
        throw new WorkspaceError(
          "invalid_input",
          "Deleting requires --yes outside an interactive terminal",
        );
      const accepted = await confirm({
        message: `Delete ${identifier}? It moves to the OS temp folder and can be restored with task undelete until that folder is cleared.`,
      });
      if (isCancel(accepted) || !accepted) return line("Cancelled", "requested");
    }
    const options = { force: args.options.has("force"), cascade: args.options.has("cascade") };
    let entry: Awaited<ReturnType<typeof deleteTask>>;
    try {
      if (identifier.startsWith("GRP-")) throw new WorkspaceError("not_found", identifier);
      const found = findDocument(await readWorkspaceIndex(context), identifier);
      entry =
        found.metadata.type === "task"
          ? await deleteTask(context, identifier, options)
          : await deleteDocument(context, identifier);
    } catch (error) {
      if (!(error instanceof WorkspaceError) || error.code !== "not_found") throw error;
      entry = await deleteTaskGroup(context, identifier, options);
    }
    if (json) output(entry);
    else {
      line(
        renderMessage(
          "success",
          `Deleted ${entry.name} · ${entry.originalPath}`,
          stdoutStyle,
          stdoutSymbols,
        ),
        "requested",
      );
      line(
        `  ${stdoutStyle.muted(`Undo with: task undelete ${entry.trashId} (temporary; the OS may clear ${entry.trashPath})`)}`,
        "requested",
      );
    }
    return;
  }

  if (command === "undelete") {
    const trashId = args.positionals[0];
    if (!trashId) throw new WorkspaceError("invalid_input", "Usage: task undelete <trash-id>");
    const entry = await restoreFromTrash(context, trashId);
    if (json) output(entry);
    else
      line(
        renderMessage(
          "success",
          `Restored ${entry.name} · ${entry.originalPath}`,
          stdoutStyle,
          stdoutSymbols,
        ),
        "requested",
      );
    return;
  }

  if (command === "trash") {
    if ((args.positionals[0] ?? "list") !== "list")
      throw new WorkspaceError("invalid_input", "Usage: task trash list");
    const entries = await listTrash(context);
    if (json) output(entries);
    else if (!entries.length) line("Trash is empty", "requested");
    else
      for (const entry of entries)
        line(`${entry.trashId}  ${entry.kind}  ${entry.name}  ${entry.originalPath}`, "requested");
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
    const errors = diagnostics.filter(isErrorDiagnostic);
    if (json) output({ valid: errors.length === 0, diagnostics });
    else if (!diagnostics.length)
      line(
        renderMessage("success", "Workspace is valid.", stdoutStyle, stdoutSymbols),
        "requested",
      );
    else
      for (const rendered of renderDiagnostics(diagnostics, stderrStyle, stderrSymbols))
        console.error(rendered);
    if (errors.length) process.exitCode = 1;
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
      const docs = tree.filter((path) => !path.startsWith("todo/"));
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
      else
        line(
          renderMessage(
            "success",
            `Created document ${document.metadata.id} · ${document.path}`,
            stdoutStyle,
            stdoutSymbols,
          ),
        );
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
        valid: !diagnostics.some(isErrorDiagnostic),
        diagnostics,
      };
      if (json) output(result);
      else
        line(
          result.valid
            ? "Index and workspace verified."
            : `${diagnostics.length} validation issue(s).`,
          "requested",
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
  else {
    const verbose = args.options.has("verbose");
    errorLine(`task: ${message}`);
    if (verbose && error instanceof Error && error.stack && !isWorkspaceError(error))
      console.error(stderrStyle.muted(error.stack));
  }
  process.exitCode =
    error instanceof WorkspaceError && error.code === "workspace_not_found" ? 2 : 1;
}
