"use client";

import { Archive, Columns3, List } from "lucide-react";
import { useMemo } from "react";
import { BoardTask, StatusDropZone } from "@/components/calendar";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { TaskSheet } from "@/components/task-sheet";

const columns = ["planned", "in-progress", "blocked", "completed"] as const;
const labels: Record<string, string> = {
  planned: "Planned",
  "in-progress": "In progress",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
};
export function TasksPageContent() {
  const {
    archivedTasks,
    groups,
    visibleTasks,
    taskFilter,
    setTaskFilter,
    taskGroupFilter: groupFilter,
    setTaskGroupFilter: setGroupFilter,
    taskView,
    setTaskView,
    openRecord,
  } = useWorkspaceApp();
  const displayed = useMemo(() => {
    const group = groups.find((item) => item.id === groupFilter);
    return visibleTasks.filter(
      (task) => !group || task.path === group.path || task.path.startsWith(`${group.path}/`),
    );
  }, [visibleTasks, groups, groupFilter]);
  return (
    <div className="tasks-page-shell">
      <div className="tasks-match">
        <header className="head">
          <div>
            <p className="sub">Drag cards to change status or schedule them.</p>
            <h1>Tasks</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <fieldset className="seg" aria-label="Task view">
              {(["Board", "List"] as const).map((view) => (
                <button
                  type="button"
                  key={view}
                  className={taskFilter !== "archived" && taskView === view ? "on" : ""}
                  onClick={() => setTaskView(view)}
                >
                  {view === "List" ? <List className="size-4" /> : <Columns3 className="size-4" />}
                  {view}
                </button>
              ))}
            </fieldset>
          </div>
        </header>
        <div className="chips">
          <button
            type="button"
            className={`chip ${!groupFilter ? "on" : ""}`}
            onClick={() => setGroupFilter("")}
          >
            All
          </button>
          {groups
            .filter((group) => !group.archived && !group.finished)
            .map((group) => (
              <button
                type="button"
                key={group.id}
                className={`chip ${groupFilter === group.id ? "on" : ""}`}
                onClick={() => setGroupFilter(group.id)}
              >
                {group.name}
              </button>
            ))}
          <button
            type="button"
            className={`chip ${taskFilter === "archived" ? "on" : ""}`}
            style={{ marginLeft: "auto" }}
            onClick={() => setTaskFilter(taskFilter === "archived" ? null : "archived")}
          >
            <Archive className="size-4" /> Archived {archivedTasks.length}
          </button>
        </div>
        {taskFilter !== "archived" && taskView === "Board" ? (
          <div className="board">
            {columns.map((status) => (
              <StatusDropZone key={status} status={status}>
                <h3>
                  <i
                    style={{
                      background:
                        status === "blocked"
                          ? "var(--bl)"
                          : status === "in-progress"
                            ? "var(--ip)"
                            : status === "completed"
                              ? "var(--dn)"
                              : "var(--pl)",
                    }}
                  />
                  {labels[status]}
                  <em>{displayed.filter((task) => task.status === status).length}</em>
                </h3>
                {displayed
                  .filter((task) => task.status === status)
                  .map((task) => (
                    <BoardTask
                      key={task.id}
                      task={{
                        ...task,
                        groupName:
                          groups.find(
                            (item) =>
                              task.path === item.path || task.path.startsWith(`${item.path}/`),
                          )?.name ??
                          task.project ??
                          "Ungrouped",
                      }}
                      onSelect={() => openRecord(task)}
                    />
                  ))}
                {displayed.every((task) => task.status !== status) && (
                  <p className="sub text-center" style={{ padding: "30px 0" }}>
                    Drop a task here
                  </p>
                )}
              </StatusDropZone>
            ))}
          </div>
        ) : (
          <div>
            {displayed.map((task) => {
              const groupName =
                groups.find(
                  (item) => task.path === item.path || task.path.startsWith(`${item.path}/`),
                )?.name ??
                task.project ??
                "Ungrouped";
              const statusColor =
                task.status === "blocked"
                  ? "var(--bl)"
                  : task.status === "in-progress"
                    ? "var(--ip)"
                    : task.status === "completed"
                      ? "var(--dn)"
                      : "var(--pl)";
              return (
                <button
                  type="button"
                  key={task.id}
                  data-tid={task.id}
                  className="lrow"
                  onClick={() => openRecord(task)}
                >
                  <span className="t">
                    <b>{task.name}</b>
                    <small>
                      {task.id} · {groupName}
                    </small>
                  </span>
                  <span
                    className="pill"
                    style={{ background: `color-mix(in srgb, ${statusColor} 16%, transparent)` }}
                  >
                    <i style={{ background: statusColor }} />
                    {labels[task.status ?? "planned"] ?? task.status}
                  </span>
                  <span className="sub" style={{ width: 56, textAlign: "right" }}>
                    {task.due_at
                      ? new Intl.DateTimeFormat("en", {
                          month: "short",
                          day: "numeric",
                        }).format(new Date(`${task.due_at}T12:00:00`))
                      : "—"}
                  </span>
                </button>
              );
            })}
            {displayed.length === 0 && (
              <p className="sub" style={{ padding: 30, textAlign: "center" }}>
                Nothing here yet.
              </p>
            )}
          </div>
        )}
      </div>
      <TaskSheet />
    </div>
  );
}
