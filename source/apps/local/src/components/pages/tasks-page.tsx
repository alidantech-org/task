"use client";

import { type DragEndEvent, useDragDropMonitor } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDot,
  Columns3,
  Flag,
  List,
  Table2,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BoardTask } from "@/components/board-task";
import { BulkBar } from "@/components/bulk-bar";
import { StatusDropZone } from "@/components/calendar";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { TaskFilterBar } from "@/components/task-filter-bar";
import { TaskSheet } from "@/components/task-sheet";
import { CustomSelect } from "@/components/ui/select";
import { planReorder, sortBoard } from "@/lib/board-order";
import { groupForTask } from "@/lib/group";
import { limitRawCompletedTasks, sortCompletedTasks } from "@/lib/overview";
import { usePersistentState } from "@/lib/persistent-state";
import {
  applyFilters,
  emptyFilters,
  isFilters,
  isSavedViews,
  type SavedView,
} from "@/lib/task-filters";
import { sortTaskView, type TaskViewDirection, type TaskViewSort } from "@/lib/task-view";

const columns = ["planned", "in-progress", "blocked", "completed"] as const;
const labels: Record<string, string> = {
  planned: "Planned",
  "in-progress": "In progress",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
};
type BoardDisplay = "detailed" | "compact";
type ListDisplay = "list" | "table";

function isBoardDisplay(value: unknown): value is BoardDisplay {
  return value === "detailed" || value === "compact";
}

function isListDisplay(value: unknown): value is ListDisplay {
  return value === "list" || value === "table";
}

function isTaskSort(value: unknown): value is TaskViewSort {
  return (
    value === "recent" ||
    value === "name" ||
    value === "group" ||
    value === "status" ||
    value === "priority" ||
    value === "due"
  );
}

function isSortDirection(value: unknown): value is TaskViewDirection {
  return value === "ascending" || value === "descending";
}

function isCollapsedGroups(value: unknown): value is Record<string, boolean> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((collapsed) => typeof collapsed === "boolean")
  );
}

export function TasksPageContent() {
  const pageTopRef = useRef<HTMLDivElement>(null);
  const {
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
  const [boardDisplay, setBoardDisplay] = usePersistentState<BoardDisplay>(
    "task:board-display",
    "detailed",
    isBoardDisplay,
  );
  const [listDisplay, setListDisplay] = usePersistentState<ListDisplay>(
    "task:list-display",
    "list",
    isListDisplay,
  );
  const [groupByGroup, setGroupByGroup] = usePersistentState(
    "task:group-by-group",
    true,
    (value): value is boolean => typeof value === "boolean",
  );
  const [listPage, setListPage] = useState(1);
  const [showAllCompletedBoard, setShowAllCompletedBoard] = useState(false);
  const [sortBy, setSortBy] = usePersistentState<TaskViewSort>(
    "task:list-sort",
    "recent",
    isTaskSort,
  );
  const [sortDirection, setSortDirection] = usePersistentState<TaskViewDirection>(
    "task:list-sort-direction",
    "descending",
    isSortDirection,
  );
  const [collapsedGroups, setCollapsedGroups] = usePersistentState<Record<string, boolean>>(
    "task:board-collapsed-groups",
    {},
    isCollapsedGroups,
  );
  const [me, setMe] = useState("");
  useEffect(() => {
    try {
      const explicitGrouping = window.localStorage.getItem("task:group-by-group");
      const previousBoardDisplay = JSON.parse(
        window.localStorage.getItem("task:board-display") ?? "null",
      ) as unknown;
      if (explicitGrouping === null && previousBoardDisplay === "grouped") {
        setGroupByGroup(true);
        setBoardDisplay("detailed");
      }
    } catch {
      // Corrupt view preferences fall back to the current defaults.
    }
  }, [setBoardDisplay, setGroupByGroup]);
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
  const filtered = useMemo(() => {
    const group = allGroups.find((item) => item.id === groupFilter);
    const matching = applyFilters(visibleTasks, filters, me).filter(
      (task) => !group || task.path === group.path || task.path.startsWith(`${group.path}/`),
    );
    const groupRank = (task: (typeof matching)[number]) => {
      const found = groupForTask(task, allGroups);
      const position = found ? allGroups.findIndex((item) => item.id === found.id) : -1;
      return position < 0 ? Number.MAX_SAFE_INTEGER : position;
    };
    return sortBoard(matching, groupRank);
  }, [visibleTasks, groupFilter, allGroups, filters, me]);
  const displayed = useMemo(
    () => (showAllCompletedBoard ? filtered : limitRawCompletedTasks(filtered, groupByGroup, 10)),
    [filtered, groupByGroup, showAllCompletedBoard],
  );
  const omittedCompleted =
    filtered.filter((task) => task.status === "completed").length -
    displayed.filter((task) => task.status === "completed").length;
  const listTasks = useMemo(
    () =>
      sortTaskView(
        filtered.map((task) => ({
          ...task,
          groupName: groupForTask(task, allGroups)?.name ?? "No wave",
        })),
        sortBy,
        sortDirection,
      ),
    [filtered, sortBy, sortDirection, allGroups],
  );
  const activeListTasks = listTasks.filter((task) => task.status !== "completed");
  const completedListTasks = listTasks.filter((task) => task.status === "completed");
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(listTasks.length / pageSize));
  const currentPage = Math.min(listPage, pageCount);
  const pagedListTasks = listTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setListPage(1);
  }, [filters, groupFilter, sortBy, sortDirection, listDisplay, groupByGroup]);
  const waveSummaries = useMemo(
    () =>
      allGroups
        .filter((group) => !group.archived)
        .map((group) => {
          const tasks = filtered.filter(
            (task) => task.path === group.path || task.path.startsWith(`${group.path}/`),
          );
          return {
            id: group.id,
            name: group.name,
            total: tasks.length,
            completed: tasks.filter((task) => task.status === "completed").length,
          };
        })
        .filter((wave) => wave.total > 0 && wave.completed < wave.total),
    [allGroups, filtered],
  );
  const taskGroups = useMemo(() => {
    const clusters: { key: string; name: string; tasks: typeof listTasks }[] = [];
    for (const task of listTasks) {
      const group = groupForTask(task, allGroups);
      const key = group?.id ?? "__ungrouped";
      const current = clusters.find((cluster) => cluster.key === key);
      if (current) current.tasks.push(task);
      else clusters.push({ key, name: group?.name ?? "No wave", tasks: [task] });
    }
    return clusters;
  }, [listTasks, allGroups]);
  const dragMonitorRef = useRef<{ onDragEnd(event: DragEndEvent): void }>({
    onDragEnd: () => undefined,
  });
  dragMonitorRef.current.onDragEnd = (event) => {
    if (event.canceled) return;
    const source = event.operation.source;
    if (!source || !isSortable(source)) return;
    const taskId = String(source.data?.taskId ?? "");
    const task = displayed.find((item) => item.id === taskId);
    if (!task) return;
    const { sortable } = source;
    const target = event.operation.target;
    const targetStatus = target?.data.status;
    const status =
      typeof targetStatus === "string"
        ? targetStatus
        : isSortable(target)
          ? String(target.sortable.group ?? task.status)
          : String(sortable.group ?? task.status ?? "planned");
    const column = displayed.filter((item) => item.status === status && item.id !== taskId);
    const targetTaskId = isSortable(target) ? String(target.data?.taskId ?? "") : "";
    const targetIndex = column.findIndex((item) => item.id === targetTaskId);
    const targetRect = isSortable(target)
      ? target.sortable.element?.getBoundingClientRect()
      : undefined;
    const pointerY =
      event.nativeEvent instanceof MouseEvent ? event.nativeEvent.clientY : undefined;
    const index =
      targetIndex < 0
        ? column.length
        : targetIndex +
          (targetRect &&
          pointerY !== undefined &&
          pointerY >= targetRect.top + targetRect.height / 2
            ? 1
            : 0);
    const unchanged =
      status === task.status &&
      String(sortable.initialGroup ?? task.status) === status &&
      index ===
        displayed
          .filter((item) => item.status === task.status)
          .findIndex((item) => item.id === taskId);
    if (unchanged) return;
    void moveOnBoard(
      task,
      status === task.status ? undefined : status,
      planReorder(column, task.path, index),
    );
  };
  const dragMonitor = useMemo(
    () => ({ onDragEnd: (event: DragEndEvent) => dragMonitorRef.current.onDragEnd(event) }),
    [],
  );
  useDragDropMonitor(dragMonitor);
  const goToListPage = (page: number) => {
    setListPage(page);
    window.requestAnimationFrame(() => {
      pageTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const viewControls =
    taskView === "Board" && taskFilter !== "archived" ? (
      <div className="task-presentation-controls board-presentation-controls">
        <fieldset className="seg board-card-controls" aria-label="Board card detail">
          {[
            { value: "detailed" as const, label: "Detailed", Icon: Columns3 },
            { value: "compact" as const, label: "Compact", Icon: List },
          ].map(({ value, label, Icon }) => (
            <button
              type="button"
              key={value}
              className={boardDisplay === value ? "on" : ""}
              aria-pressed={boardDisplay === value}
              title={`${label} task cards`}
              onClick={() => setBoardDisplay(value)}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </fieldset>
      </div>
    ) : taskView === "List" || taskFilter === "archived" ? (
      <div className="task-presentation-controls list-presentation-controls">
        <CustomSelect
          label="Sort tasks"
          value={sortBy}
          onValueChange={(value) => setSortBy(value as TaskViewSort)}
          className="task-sort-select"
          options={[
            { value: "recent", label: "Recently completed / updated" },
            { value: "name", label: "Task name" },
            { value: "group", label: "Wave" },
            { value: "status", label: "Status" },
            { value: "priority", label: "Priority" },
            { value: "due", label: "Due date" },
          ]}
        />
        <button
          type="button"
          className="task-sort-direction"
          aria-label={`Sort ${sortDirection}`}
          title={`Sort ${sortDirection}`}
          onClick={() =>
            setSortDirection(sortDirection === "ascending" ? "descending" : "ascending")
          }
        >
          {sortDirection === "ascending" ? (
            <ArrowUp className="size-4" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    ) : undefined;

  function sortFromTable(column: TaskViewSort): void {
    if (sortBy === column) {
      setSortDirection(sortDirection === "ascending" ? "descending" : "ascending");
      return;
    }
    setSortBy(column);
    setSortDirection(column === "recent" || column === "due" ? "descending" : "ascending");
  }

  function renderListRow(task: (typeof listTasks)[number]) {
    return (
      <button
        type="button"
        key={task.id}
        data-tid={task.id}
        className={`task-list-row ${selecting && picked.includes(task.id) ? "is-picked" : ""}`}
        aria-pressed={selecting ? picked.includes(task.id) : undefined}
        onClick={() => (selecting ? toggle(task.id) : openRecord(task))}
      >
        {selecting ? (
          <span
            className={`card-check inline task-selection-check ${picked.includes(task.id) ? "on" : ""}`}
            aria-hidden="true"
          >
            {picked.includes(task.id) ? "✓" : ""}
          </span>
        ) : (
          <span
            className={`task-row-status s-${task.status ?? "planned"}`}
            role="img"
            aria-label={labels[task.status ?? "planned"]}
          >
            {task.status === "completed" ? (
              <CircleCheck />
            ) : task.status === "in-progress" ? (
              <CircleDot />
            ) : task.status === "blocked" ? (
              <Ban />
            ) : (
              <Circle />
            )}
          </span>
        )}
        <span className="task-list-copy">
          <b title={task.name}>{task.name}</b>
          <small>{task.id}</small>
        </span>
        {task.priority && task.priority !== "medium" ? (
          <span
            className={`task-list-priority priority-${task.priority}`}
            title={`${task.priority} priority`}
          >
            <Flag aria-hidden="true" /> {task.priority}
          </span>
        ) : (
          <span />
        )}
        <span className="task-list-due">
          {task.due_at
            ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
                new Date(`${task.due_at}T12:00:00`),
              )
            : "—"}
        </span>
      </button>
    );
  }

  function renderTableRow(task: (typeof listTasks)[number]) {
    const groupName = groupForTask(task, allGroups)?.name ?? "No wave";
    return (
      <tr
        key={task.id}
        data-tid={task.id}
        className={selecting && picked.includes(task.id) ? "is-picked" : ""}
        onClick={() => (selecting ? toggle(task.id) : openRecord(task))}
      >
        <td className="task-table-name">
          <span className="task-table-title-line">
            {selecting && (
              <span
                className={`card-check inline task-selection-check ${picked.includes(task.id) ? "on" : ""}`}
              >
                {picked.includes(task.id) ? "✓" : ""}
              </span>
            )}
            <span title={task.name}>{task.name}</span>
          </span>
        </td>
        <td title={groupName}>{groupName}</td>
        <td>
          <span className={`task-table-status s-${task.status ?? "planned"}`}>
            {labels[task.status ?? "planned"] ?? task.status}
          </span>
        </td>
        <td className="task-table-priority">{task.priority ?? "—"}</td>
        <td>{task.due_at ?? "—"}</td>
        <td>
          {task.updated_at
            ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
                new Date(task.updated_at),
              )
            : "—"}
        </td>
      </tr>
    );
  }

  const tableHeader = (
    <thead>
      <tr>
        {[
          ["name", "Task"],
          ["group", "Wave"],
          ["status", "Status"],
          ["priority", "Priority"],
          ["due", "Due date"],
          ["recent", "Updated"],
        ].map(([key, label]) => (
          <th
            key={key}
            aria-sort={sortBy === key ? sortDirection : "none"}
            className={key === "name" ? "task-table-name" : undefined}
          >
            <button
              type="button"
              onClick={() => sortFromTable(key as TaskViewSort)}
              title={`Sort by ${label}`}
            >
              {label}
              {sortBy === key &&
                (sortDirection === "ascending" ? (
                  <ArrowUp aria-hidden="true" />
                ) : (
                  <ArrowDown aria-hidden="true" />
                ))}
            </button>
          </th>
        ))}
      </tr>
    </thead>
  );

  function renderTaskTable(tasks: typeof listTasks) {
    if (!groupByGroup) {
      return (
        <div className="task-table-scroll">
          <table className="task-table">
            {tableHeader}
            <tbody>{tasks.map(renderTableRow)}</tbody>
          </table>
        </div>
      );
    }
    return (
      <div className="task-table-scroll">
        <table className="task-table grouped-task-table">
          {tableHeader}
          {taskGroups
            .map((group) => ({
              ...group,
              tasks: group.tasks.filter((task) => tasks.some((item) => item.id === task.id)),
            }))
            .filter((group) => group.tasks.length > 0)
            .map((group) => (
              <tbody key={group.key}>
                <tr className="task-table-group-row">
                  <th colSpan={6}>
                    <span>{group.name}</span>
                    <small>{group.tasks.length} tasks</small>
                  </th>
                </tr>
                {group.tasks.map(renderTableRow)}
              </tbody>
            ))}
        </table>
      </div>
    );
  }

  function renderListPresentation(tasks: typeof listTasks) {
    const grouped = groupByGroup
      ? taskGroups
          .map((group) => ({
            ...group,
            tasks: group.tasks.filter((task) => tasks.some((item) => item.id === task.id)),
          }))
          .filter((group) => group.tasks.length > 0)
      : [{ key: "all", name: "", tasks }];
    if (listDisplay === "table") return renderTaskTable(tasks);
    return (
      <div className="task-groups-list">
        {grouped.map((group) => (
          <section className="task-view-group" key={group.key}>
            {groupByGroup && (
              <header className="task-view-group-header">
                <Waves aria-hidden="true" />
                <h2 title={group.name}>{group.name}</h2>
                <span className="task-group-divider" />
                <small>{group.tasks.length} tasks</small>
              </header>
            )}
            <div className="task-list">{group.tasks.map(renderListRow)}</div>
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className="tasks-page-shell" ref={pageTopRef}>
      <div className="tasks-match">
        <header className="head">
          <div>
            <p className="sub">
              {taskView === "Board"
                ? "Drag cards to change status or schedule them."
                : `${activeListTasks.length} open · ${completedListTasks.length} done`}
            </p>
            <h1>Tasks</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <fieldset className="seg" aria-label="Task view">
              {(["Board", "List", "Table"] as const).map((view) => (
                <button
                  type="button"
                  key={view}
                  className={
                    taskFilter !== "archived" &&
                    (view === "Board"
                      ? taskView === "Board"
                      : taskView === "List" && listDisplay === view.toLowerCase())
                      ? "on"
                      : ""
                  }
                  onClick={() => {
                    if (view === "Board") setTaskView("Board");
                    else {
                      setTaskView("List");
                      setListDisplay(view.toLowerCase() as ListDisplay);
                    }
                  }}
                >
                  {view === "Board" ? (
                    <Columns3 className="size-4" />
                  ) : view === "Table" ? (
                    <Table2 className="size-4" />
                  ) : (
                    <List className="size-4" />
                  )}
                  {view}
                </button>
              ))}
            </fieldset>
          </div>
        </header>
        {selecting ? (
          <BulkBar
            count={picked.length}
            total={
              taskView === "Board" && taskFilter !== "archived"
                ? displayed.length
                : listTasks.length
            }
            groups={groups}
            busy={bulkBusy}
            onSelectAll={() =>
              setPicked(
                (taskView === "Board" && taskFilter !== "archived" ? displayed : listTasks).map(
                  (task) => task.id,
                ),
              )
            }
            onClearSelection={() => setPicked([])}
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
        ) : (
          <>
            <TaskFilterBar
              filters={filters}
              onFilters={setFilters}
              views={views}
              onViews={setViews}
              assignees={assignees}
              tags={labelNames}
              groups={allGroups.filter((group) => !group.archived)}
              groupId={groupFilter}
              onGroup={setGroupFilter}
              archived={taskFilter === "archived"}
              onArchived={(archived) => setTaskFilter(archived ? "archived" : null)}
              selecting={selecting}
              onSelecting={(next) => {
                setSelecting(next);
                setPicked([]);
              }}
              matching={filtered.length}
              organizeByWave={groupByGroup}
              onOrganizeByWave={setGroupByGroup}
              viewControls={viewControls}
            />
            {taskView === "List" && taskFilter !== "archived" && waveSummaries.length > 0 && (
              <nav className="task-wave-strip" aria-label="Task waves">
                {waveSummaries.map((wave) => (
                  <button
                    type="button"
                    key={wave.id}
                    className={groupFilter === wave.id ? "on" : ""}
                    onClick={() => setGroupFilter(groupFilter === wave.id ? "" : wave.id)}
                  >
                    <span>
                      <b>{wave.name}</b>
                      <small>
                        {wave.completed}/{wave.total}
                      </small>
                    </span>
                    <i>
                      <span
                        style={{ width: `${Math.round((wave.completed / wave.total) * 100)}%` }}
                      />
                    </i>
                  </button>
                ))}
              </nav>
            )}
          </>
        )}
        {taskFilter !== "archived" && taskView === "Board" ? (
          <div className={`board ${boardDisplay === "compact" ? "compact" : ""}`}>
            {columns.map((status) => {
              const statusTasksUnsorted = displayed.filter((task) => task.status === status);
              const statusTasks =
                status === "completed" && !groupByGroup
                  ? sortCompletedTasks(statusTasksUnsorted)
                  : statusTasksUnsorted;
              const renderTask = (task: (typeof displayed)[number], index: number) => (
                <BoardTask
                  key={task.id}
                  task={task}
                  index={index}
                  onSelect={() => openRecord(task)}
                  selection={selectionFor(task.id)}
                  compact={boardDisplay === "compact"}
                  showGroup={boardDisplay === "detailed" && !groupByGroup}
                />
              );
              if (groupByGroup) {
                const clusters: {
                  key: string;
                  name: string;
                  tasks: (typeof displayed)[number][];
                }[] = [];
                for (const task of statusTasks) {
                  const group = groupForTask(task, allGroups);
                  const key = group?.id ?? "__ungrouped";
                  const current = clusters.find((cluster) => cluster.key === key);
                  if (current) current.tasks.push(task);
                  else clusters.push({ key, name: group?.name ?? "No wave", tasks: [task] });
                }
                const sortableTasks = clusters.flatMap((cluster) => cluster.tasks);
                return (
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
                      <em>{statusTasks.length}</em>
                    </h3>
                    {clusters.length > 0 ? (
                      <div className="board-group-list">
                        {clusters.map((cluster) => {
                          const collapseKey = `${status}:${cluster.key}`;
                          const collapsed = collapsedGroups[collapseKey] ?? false;
                          const dated = cluster.tasks.filter((task) => task.due_at).length;
                          return (
                            <section
                              className={`board-group ${collapsed ? "collapsed" : "expanded"}`}
                              key={cluster.key}
                            >
                              <button
                                type="button"
                                className="board-group-toggle"
                                aria-expanded={!collapsed}
                                aria-label={`${collapsed ? "Expand" : "Collapse"} ${cluster.name}, ${cluster.tasks.length} task${cluster.tasks.length === 1 ? "" : "s"}`}
                                onClick={() =>
                                  setCollapsedGroups({
                                    ...collapsedGroups,
                                    [collapseKey]: !collapsed,
                                  })
                                }
                              >
                                {collapsed ? (
                                  <ChevronRight aria-hidden="true" />
                                ) : (
                                  <ChevronDown aria-hidden="true" />
                                )}
                                <span className="board-group-name">{cluster.name}</span>
                                <span className="board-group-rule" />
                                <span className="board-group-info">
                                  {cluster.tasks.length} task{cluster.tasks.length === 1 ? "" : "s"}
                                  {dated > 0 ? ` · ${dated} due` : ""}
                                </span>
                              </button>
                              <div className="board-group-body">
                                {cluster.tasks.map((task) => (
                                  <BoardTask
                                    key={task.id}
                                    task={task}
                                    index={sortableTasks.findIndex((item) => item.id === task.id)}
                                    onSelect={() => openRecord(task)}
                                    selection={selectionFor(task.id)}
                                    compact={collapsed || boardDisplay === "compact"}
                                    showGroup={false}
                                  />
                                ))}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="sub text-center" style={{ padding: "30px 0" }}>
                        Drop a task here
                      </p>
                    )}
                  </StatusDropZone>
                );
              }
              return (
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
                    <em>{statusTasks.length}</em>
                  </h3>
                  {statusTasks.map(renderTask)}
                  {status === "completed" && omittedCompleted > 0 && !groupByGroup && (
                    <button
                      type="button"
                      className="board-view-all"
                      onClick={() => setShowAllCompletedBoard(true)}
                    >
                      View all {filtered.filter((task) => task.status === "completed").length}{" "}
                      completed tasks
                      <ChevronRight aria-hidden="true" />
                    </button>
                  )}
                  {statusTasks.length === 0 && (
                    <p className="sub text-center" style={{ padding: "30px 0" }}>
                      Drop a task here
                    </p>
                  )}
                </StatusDropZone>
              );
            })}
          </div>
        ) : (
          <>
            {listTasks.length > 0 ? (
              <div className="task-paginated-view">
                {renderListPresentation(pagedListTasks)}
                {pageCount > 1 && (
                  <nav className="task-pagination" aria-label="Task pages">
                    <span>
                      {(currentPage - 1) * pageSize + 1}–
                      {Math.min(currentPage * pageSize, listTasks.length)} of {listTasks.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => goToListPage(currentPage - 1)}
                    >
                      Previous
                    </button>
                    <b>
                      Page {currentPage} of {pageCount}
                    </b>
                    <button
                      type="button"
                      disabled={currentPage === pageCount}
                      onClick={() => goToListPage(currentPage + 1)}
                    >
                      Next
                    </button>
                  </nav>
                )}
              </div>
            ) : (
              <p className="sub" style={{ padding: 30, textAlign: "center" }}>
                Nothing here yet.
              </p>
            )}
          </>
        )}
      </div>
      <TaskSheet />
    </div>
  );
}
