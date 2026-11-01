"use client";

import { DragOverlay, useDragDropMonitor } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { Archive, Columns3, List } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BoardTask, BoardTaskPreview } from "@/components/board-task";
import { BulkBar } from "@/components/bulk-bar";
import { StatusDropZone } from "@/components/calendar";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { TaskFilterBar } from "@/components/task-filter-bar";
import { TaskSheet } from "@/components/task-sheet";
import { planReorder, sortBoard } from "@/lib/board-order";
import { groupForTask } from "@/lib/group";
import { usePersistentState } from "@/lib/persistent-state";
import {
  applyFilters,
  emptyFilters,
  isFilters,
  isSavedViews,
  type SavedView,
} from "@/lib/task-filters";

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
    allGroups,
    visibleTasks,
    taskFilter,
    setTaskFilter,
    taskGroupFilter: groupFilter,
    setTaskGroupFilter: setGroupFilter,
    taskView,
    setTaskView,
    openRecord,
    moveOnBoard,
    bulkUpdate,
  } = useWorkspaceApp();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  const selectionFor = (id: string) =>
    selecting ? { checked: picked.includes(id), onToggle: () => toggle(id) } : undefined;
  const [filters, setFilters] = usePersistentState("task:filters", emptyFilters, isFilters);
  const [views, setViews] = usePersistentState<SavedView[]>("task:views", [], isSavedViews);
  const [me, setMe] = useState("");
  useEffect(() => {
    void fetch("/api/runtime/workspace/identity", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { author?: string };
        if (response.ok) setMe(payload.author ?? "");
      })
      .catch(() => undefined);
  }, []);
  const assignees = useMemo(
    () =>
      [
        ...new Set(
          visibleTasks.map((task) => task.assignee).filter((name): name is string => Boolean(name)),
        ),
      ].sort(),
    [visibleTasks],
  );
  const labelNames = useMemo(
    () => [...new Set(visibleTasks.flatMap((task) => task.tags))].sort(),
    [visibleTasks],
  );
  const displayed = useMemo(() => {
    const group = groups.find((item) => item.id === groupFilter);
    const filtered = applyFilters(visibleTasks, filters, me).filter(
      (task) => !group || task.path === group.path || task.path.startsWith(`${group.path}/`),
    );
    const groupRank = (task: (typeof filtered)[number]) => {
      const found = groupForTask(task, allGroups);
      const position = found ? allGroups.findIndex((item) => item.id === found.id) : -1;
      return position < 0 ? Number.MAX_SAFE_INTEGER : position;
    };
    return sortBoard(filtered, groupRank);
  }, [visibleTasks, groups, groupFilter, allGroups, filters, me]);
  useDragDropMonitor({
    onDragEnd(event) {
      if (event.canceled) return;
      const source = event.operation.source;
      if (!source || !isSortable(source)) return;
      const taskId = String(source.data?.taskId ?? "");
      const task = displayed.find((item) => item.id === taskId);
      if (!task) return;
      const { sortable } = source;
      const status = String(sortable.group ?? task.status);
      const unchanged =
        status === task.status &&
        String(sortable.initialGroup ?? task.status) === status &&
        sortable.index === sortable.initialIndex;
      if (unchanged) return;
      const column = displayed.filter((item) => item.status === status && item.id !== taskId);
      void moveOnBoard(
        task,
        status === task.status ? undefined : status,
        planReorder(column, task.path, sortable.index),
      );
    },
  });
  return (
    <div className="tasks-page-shell">
      <div className="tasks-match">
        <header className="head">
          <div>
            <p className="sub">Drag cards to change status or schedule them.</p>
            <h1>Tasks</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`btn2 ${selecting ? "on" : ""}`}
              aria-pressed={selecting}
              onClick={() => {
                setSelecting(!selecting);
                setPicked([]);
              }}
            >
              {selecting ? "Cancel selection" : "Select"}
            </button>
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
        <TaskFilterBar
          filters={filters}
          onFilters={setFilters}
          views={views}
          onViews={setViews}
          assignees={assignees}
          tags={labelNames}
          matching={displayed.length}
        />
        {selecting && (
          <BulkBar
            count={picked.length}
            total={displayed.length}
            groups={groups}
            busy={bulkBusy}
            onSelectAll={() => setPicked(displayed.map((task) => task.id))}
            onClear={() => {
              setSelecting(false);
              setPicked([]);
            }}
            onApply={(patch) => {
              setBulkBusy(true);
              void bulkUpdate(picked, patch)
                .then((result) => setPicked(result.failed.map((line) => line.split(":")[0] ?? "")))
                .finally(() => setBulkBusy(false));
            }}
          />
        )}
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
                  .map((task, index) => (
                    <BoardTask
                      key={task.id}
                      task={task}
                      index={index}
                      onSelect={() => openRecord(task)}
                      selection={selectionFor(task.id)}
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
              const groupName = task.groupName ?? "Ungrouped";
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
                  className={`lrow ${selecting && picked.includes(task.id) ? "is-picked" : ""}`}
                  aria-pressed={selecting ? picked.includes(task.id) : undefined}
                  onClick={() => (selecting ? toggle(task.id) : openRecord(task))}
                >
                  {selecting && (
                    <span
                      className={`card-check inline ${picked.includes(task.id) ? "on" : ""}`}
                      aria-hidden="true"
                    >
                      {picked.includes(task.id) ? "✓" : ""}
                    </span>
                  )}
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
      <DragOverlay>
        {(source) => {
          const dragged = displayed.find((item) => item.id === source?.data?.taskId);
          return dragged ? <BoardTaskPreview task={dragged} /> : null;
        }}
      </DragOverlay>
      <TaskSheet />
    </div>
  );
}
