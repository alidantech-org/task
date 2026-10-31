import type { TaskGroup } from "@task/workspace";
import type { Style } from "#/output/style";
import type { Symbols } from "#/output/symbols";

export interface OverviewData {
  workspace: string;
  groups: number;
  completedGroups?: number;
  archivedGroups: number;
  tasks: number;
  documents: number;
  diagnostics: number;
}

export function renderOverview(
  data: OverviewData,
  groups: readonly TaskGroup[],
  style: Style,
  symbols: Symbols,
): string[] {
  const active = groups.filter((group) => !group.archived && !group.finished);
  return [
    `${style.strong("TASK")}  ${style.muted(data.workspace)}`,
    `${style.accent(String(data.tasks))} active ${data.tasks === 1 ? "task" : "tasks"}  ${symbols.bullet}  ${data.groups} groups${data.completedGroups ? ` · ${data.completedGroups} completed` : ""}  ${symbols.bullet}  ${data.documents} documents${data.diagnostics ? `  ${symbols.bullet}  ${style.warning(`${data.diagnostics} issues`)}` : ""}`,
    ...active.map(
      (group) =>
        `  ${symbols.group} ${group.name}  ${group.completed}/${group.total} done  ${style.muted(group.path)}`,
    ),
    ...(data.tasks === 0
      ? [style.muted('No tasks yet. Start with: task group create --title "My project"')]
      : []),
  ];
}
