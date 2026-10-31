import { cancel, isCancel, select } from "@clack/prompts";

export type MenuAction =
  | "info"
  | "list"
  | "create"
  | "group-create"
  | "search"
  | "docs"
  | "validate"
  | "quit";

export async function workspaceMenu(workspace: string): Promise<MenuAction> {
  const action = await select({
    message: `Task · ${workspace}`,
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
    cancel("Cancelled");
    process.exit(130);
  }
  return action;
}
