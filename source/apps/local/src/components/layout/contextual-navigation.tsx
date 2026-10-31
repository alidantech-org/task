"use client";

import { Button } from "@task/ui";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  FileText,
  Folder,
  FolderKanban,
  Gauge,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { Dispatch, KeyboardEvent, PointerEvent, SetStateAction } from "react";

type TaskRecord = { id: string; status?: string; due_at?: string };
type WorkspaceGroup = {
  id: string;
  name: string;
  archived: boolean;
  finished?: boolean;
  total: number;
};
type DocumentFolder = { path: string; depth: number; name: string };
type ContextualNavigationProps = {
  section: string;
  taskFilter: string | null;
  sidebarCompact: boolean;
  sidebarVisible: boolean;
  setSidebarCompact(compact: boolean): void;
  sidebarWidth: number;
  tasks: TaskRecord[];
  setSidebarVisible: Dispatch<SetStateAction<boolean>>;
  completedTasks: TaskRecord[];
  archivedTasks: TaskRecord[];
  dueSoonCount: number;
  selectSavedView(filter: string): void;
  selectSection(label: string): void;
  docs: { path: string }[];
  documentFolder: string;
  selectDocumentFolder(path: string): void;
  visibleDocumentFolders: DocumentFolder[];
  collapsedDocumentFolders: string[];
  setCollapsedDocumentFolders(update: (current: string[]) => string[]): void;
  groups: WorkspaceGroup[];
  resizeSidebar(event: PointerEvent<HTMLDivElement>): void;
  resizeSidebarByKeyboard(event: KeyboardEvent<HTMLDivElement>): void;
};
const operations = [
  { label: "Agent prompts", icon: BookOpen },
  { label: "Activity", icon: Activity },
  { label: "Workspace health", icon: Gauge },
];
const statusNames: Record<string, string> = {
  planned: "Planned",
  "in-progress": "In progress",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
};
export function ContextualNavigation({
  section,
  taskFilter,
  sidebarCompact,
  sidebarVisible,
  setSidebarCompact,
  sidebarWidth,
  tasks,
  setSidebarVisible,
  completedTasks,
  archivedTasks,
  dueSoonCount,
  selectSavedView,
  selectSection,
  docs,
  documentFolder,
  selectDocumentFolder,
  visibleDocumentFolders,
  collapsedDocumentFolders,
  setCollapsedDocumentFolders,
  groups,
  resizeSidebar,
  resizeSidebarByKeyboard,
}: ContextualNavigationProps) {
  return (
    <aside
      data-slot="contextual-sidebar"
      data-compact={sidebarCompact}
      aria-label={`${section} navigation`}
      className={`relative flex h-full min-h-0 shrink-0 flex-col border-r border-border/60 ${sidebarCompact ? "w-14 bg-background px-1.5" : "bg-card/20 px-3"} transition-[width]`}
      style={{
        ...(sidebarVisible && !sidebarCompact ? { width: sidebarWidth } : {}),
      }}
    >
      {sidebarVisible && (
        <>
          <div
            className={`flex h-12 shrink-0 items-center border-b border-border/50 ${sidebarCompact ? "justify-center" : "justify-between px-1"}`}
          >
            {sidebarCompact ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Expand sidebar"
                title="Expand sidebar"
                onClick={() => setSidebarCompact(false)}
              >
                <PanelLeftOpen className="size-4" />
              </Button>
            ) : (
              <span className="truncate text-xs font-semibold">
                {section === "Tasks" && taskFilter ? statusNames[taskFilter] : section}
              </span>
            )}
            {!sidebarCompact && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Hide sidebar"
                title="Hide sidebar"
                onClick={() => setSidebarVisible(false)}
              >
                <PanelLeftClose className="size-4" />
              </Button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-3">
            {section === "Tasks" && (
              <nav aria-label="Task filters" className="space-y-1">
                {[
                  {
                    id: null,
                    label: "All tasks",
                    icon: ListTodo,
                    count: tasks.length,
                  },
                  {
                    id: "planned",
                    label: "Planned",
                    icon: CircleDot,
                    count: tasks.filter((task) => task.status === "planned").length,
                  },
                  {
                    id: "in-progress",
                    label: "In progress",
                    icon: CircleDot,
                    count: tasks.filter((task) => task.status === "in-progress").length,
                  },
                  {
                    id: "blocked",
                    label: "Blocked",
                    icon: AlertTriangle,
                    count: tasks.filter((task) => task.status === "blocked").length,
                  },
                  {
                    id: "due-soon",
                    label: "Due soon",
                    icon: Clock3,
                    count: dueSoonCount,
                  },
                  {
                    id: "completed",
                    label: "Completed",
                    icon: Check,
                    count: completedTasks.length,
                  },
                  {
                    id: "archived",
                    label: "Archived",
                    icon: Folder,
                    count: archivedTasks.length,
                  },
                ].map(({ id, label, icon: Icon, count }) => (
                  <button
                    type="button"
                    key={id ?? "all"}
                    aria-current={(taskFilter ?? null) === id ? "page" : undefined}
                    title={sidebarCompact ? label : undefined}
                    onClick={() => (id ? selectSavedView(id) : selectSection("Tasks"))}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs ${sidebarCompact ? "justify-center px-1" : ""} ${(taskFilter ?? null) === id ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!sidebarCompact && (
                      <>
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        <span className="tabular-nums text-[10px]">{count}</span>
                      </>
                    )}
                  </button>
                ))}
              </nav>
            )}
            {section === "Documents" && (
              <nav aria-label="Managed document folders" className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => selectDocumentFolder("")}
                  title={sidebarCompact ? "All documents" : undefined}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs ${sidebarCompact ? "justify-center px-1" : ""} ${!documentFolder ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"}`}
                >
                  <FileText className="size-4 shrink-0" />
                  {!sidebarCompact && (
                    <>
                      <span className="flex-1">All documents</span>
                      <span>{docs.length}</span>
                    </>
                  )}
                </button>
                {!sidebarCompact &&
                  visibleDocumentFolders.map((folder) => {
                    const expanded = !collapsedDocumentFolders.includes(folder.path);
                    return (
                      <div
                        key={folder.path}
                        className="flex items-center gap-0.5"
                        style={{ paddingLeft: `${folder.depth * 10}px` }}
                      >
                        <button
                          type="button"
                          onClick={() => selectDocumentFolder(folder.path)}
                          className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-xs ${documentFolder === folder.path ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"}`}
                        >
                          <Folder className="size-3.5 shrink-0" />
                          <span className="truncate">{folder.name}</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`${expanded ? "Collapse" : "Expand"} ${folder.name}`}
                          aria-expanded={expanded}
                          onClick={() =>
                            setCollapsedDocumentFolders((current) =>
                              expanded
                                ? [...current, folder.path]
                                : current.filter((path) => path !== folder.path),
                            )
                          }
                          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                        >
                          <ChevronDown className={`size-3.5 ${expanded ? "" : "-rotate-90"}`} />
                        </button>
                      </div>
                    );
                  })}
              </nav>
            )}
            {section === "Groups" && (
              <div className="space-y-4">
                {(["Active groups", "Completed groups", "Archived groups"] as const).map(
                  (heading, index) => {
                    const items = groups.filter((item) =>
                      index === 0
                        ? !item.archived && !item.finished
                        : index === 1
                          ? item.finished
                          : item.archived,
                    );
                    return (
                      <section key={heading}>
                        {!sidebarCompact && (
                          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {heading}
                          </p>
                        )}
                        {items.slice(0, sidebarCompact ? 6 : 30).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            title={
                              sidebarCompact ? `${item.name} · ${item.total} tasks` : undefined
                            }
                            onClick={() => selectSection("Groups")}
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-muted-foreground hover:bg-accent/60 ${sidebarCompact ? "justify-center" : ""}`}
                          >
                            <FolderKanban className="size-4 shrink-0" />
                            {!sidebarCompact && (
                              <span className="min-w-0 flex-1 truncate">{item.name}</span>
                            )}
                          </button>
                        ))}
                        {items.length === 0 && !sidebarCompact && (
                          <p className="px-2 py-1 text-xs text-muted-foreground">None</p>
                        )}
                      </section>
                    );
                  },
                )}
              </div>
            )}
            {section === "Overview" && (
              <nav aria-label="Overview shortcuts" className="space-y-1">
                {[
                  { label: "All tasks", section: "Tasks", icon: ListTodo },
                  {
                    label: "Recent changes",
                    section: "Activity",
                    icon: Activity,
                  },
                  {
                    label: "Workspace health",
                    section: "Workspace health",
                    icon: Gauge,
                  },
                ].map(({ label, section: target, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    title={sidebarCompact ? label : undefined}
                    onClick={() => selectSection(target)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-muted-foreground hover:bg-accent/60 ${sidebarCompact ? "justify-center px-1" : ""}`}
                  >
                    <Icon className="size-4" />
                    {!sidebarCompact && label}
                  </button>
                ))}
              </nav>
            )}
            <section className="mt-6 border-t border-border/50 pt-3">
              {!sidebarCompact && (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Workspace
                </p>
              )}
              {operations.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  title={sidebarCompact ? label : undefined}
                  aria-current={section === label ? "page" : undefined}
                  onClick={() => selectSection(label)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs ${sidebarCompact ? "justify-center px-1" : ""} ${section === label ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"}`}
                >
                  <Icon className="size-4 shrink-0" />
                  {!sidebarCompact && label}
                </button>
              ))}
            </section>
          </div>
          {/* biome-ignore lint/a11y/useSemanticElements: A focusable vertical resize handle cannot be represented by an hr. */}
          <div
            role="separator"
            aria-label="Resize contextual sidebar"
            aria-orientation="vertical"
            aria-valuemin={208}
            aria-valuemax={360}
            aria-valuenow={sidebarCompact ? 56 : sidebarWidth}
            aria-valuetext={sidebarCompact ? "Compact" : `${sidebarWidth} pixels`}
            tabIndex={0}
            onPointerDown={resizeSidebar}
            onPointerMove={resizeSidebar}
            onPointerUp={resizeSidebar}
            onPointerCancel={resizeSidebar}
            onKeyDown={resizeSidebarByKeyboard}
            className={`group absolute inset-y-0 -right-1 z-20 hidden h-full w-2 cursor-col-resize touch-none border-0 bg-transparent outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded-full after:bg-transparent after:content-[''] md:block ${sidebarCompact ? "" : "hover:after:bg-border focus-visible:after:bg-ring"}`}
          />
        </>
      )}
    </aside>
  );
}
