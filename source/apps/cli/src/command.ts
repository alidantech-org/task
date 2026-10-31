import type { TaskPriority, TaskStatus, WorkspaceError } from "@task/workspace";

export const taskStatuses: readonly TaskStatus[] = [
  "planned",
  "in-progress",
  "blocked",
  "completed",
];
export const taskPriorities: readonly TaskPriority[] = ["low", "medium", "high"];

export interface CliMetadata {
  name: "task";
  version: string;
  aliases: readonly ["task", "tk"];
  status: "workspace-connected";
  commands: readonly string[];
}

export function getCliMetadata(version: string): CliMetadata {
  return {
    name: "task",
    version,
    aliases: ["task", "tk"],
    status: "workspace-connected",
    commands: [
      "doctor",
      "info",
      "status",
      "stats",
      "tree",
      "group",
      "list",
      "show",
      "search",
      "create",
      "update",
      "edit",
      "archive",
      "restore",
      "validate",
      "docs",
      "index",
    ],
  };
}

export function resolveCommand(args: readonly string[]): string | undefined {
  return args.find((argument) => !argument.startsWith("-"));
}

export type ParsedArgs = {
  command?: string;
  positionals: string[];
  options: Map<string, string | boolean>;
};

const booleanOptions = new Set([
  "json",
  "plain",
  "no-color",
  "quiet",
  "verbose",
  "help",
  "version",
  "archived",
  "watch",
]);
const valueOptions = new Set([
  "workspace",
  "status",
  "priority",
  "assignee",
  "tag",
  "project",
  "sort",
  "limit",
  "group",
  "title",
  "description",
  "due",
  "depends-on",
  "path",
  "body",
  "in",
  "type",
  "editor",
  "extra",
]);

export function parseArgs(args: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const options = new Map<string, string | boolean>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("-") || arg === "-") {
      positionals.push(arg);
      continue;
    }
    const equal = arg.indexOf("=");
    const rawKey = equal >= 0 ? arg.slice(0, equal) : arg;
    const key = rawKey.replace(/^-+/, "");
    if (key === "h") {
      options.set("help", true);
      continue;
    }
    if (key === "v") {
      options.set("version", true);
      continue;
    }
    if (key === "no-color") {
      options.set("no-color", true);
      continue;
    }
    if (booleanOptions.has(key)) {
      options.set(key, true);
      continue;
    }
    if (!valueOptions.has(key)) throw new Error(`Unknown option: ${rawKey}`);
    const value = equal >= 0 ? arg.slice(equal + 1) : args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Option --${key} requires a value`);
    if (equal < 0) index += 1;
    options.set(key, value);
  }
  return { command: positionals.shift(), positionals, options };
}

export function optionString(args: ParsedArgs, key: string): string | undefined {
  const value = args.options.get(key);
  return typeof value === "string" ? value : undefined;
}

export function optionList(args: ParsedArgs, key: string): string[] {
  const value = optionString(args, key);
  return value
    ? value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
}

export function isWorkspaceError(error: unknown): error is WorkspaceError {
  return error instanceof Error && error.name === "WorkspaceError";
}
