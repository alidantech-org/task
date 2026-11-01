"use client";

import { Button } from "@task/ui";
import {
  Archive,
  ArchiveRestore,
  Columns3,
  Eye,
  EyeOff,
  List,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BoardTask, StatusDropZone } from "@/components/calendar";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { MarkdownBody } from "@/components/markdown-body";
import { MarkdownEditor } from "@/components/markdown-editor";
import { TaskChanges } from "@/components/task-changes";
import { DatePicker } from "@/components/ui/date-picker";
import { CustomSelect } from "@/components/ui/select";
import { buildLinkContext } from "@/lib/link-context";
import { markdownChecklistProgress, toggleMarkdownCheckbox } from "@/lib/markdown";

const columns = ["planned", "in-progress", "blocked", "completed"] as const;
const labels: Record<string, string> = {
  planned: "Planned",
  "in-progress": "In progress",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
};
function openSegment(task: {
  extra?: { tracking?: { segments: readonly { ended_at?: string }[] } };
}): boolean {
  const last = task.extra?.tracking?.segments.at(-1);
  return Boolean(last && !last.ended_at);
}

export function TasksPageContent() {
  const [drawerHost, setDrawerHost] = useState<HTMLElement | null>(null);
  const {
    archivedTasks,
    groups,
    workspace,
    records,
    visibleTasks,
    taskFilter,
    setTaskFilter,
    taskGroupFilter: groupFilter,
    setTaskGroupFilter: setGroupFilter,
    taskView,
    setTaskView,
    openRecord,
    updateTaskStatus,
    updateTaskDue,
    updateTaskPriority,
    setTaskHiddenFromRecent,
    setTaskArchived,
    deleteRecord,
    startTaskTracking,
    selected,
    detail,
    saveBody,
    setNotice,
  } = useWorkspaceApp();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const checklist = markdownChecklistProgress(detail?.body ?? "");
  useEffect(() => {
    setDraft(detail?.body ?? "");
    setEditing(false);
  }, [detail?.body]);
  useEffect(() => {
    setDrawerHost(document.querySelector<HTMLElement>('[data-slot="task-panel"]'));
  }, []);
  const displayed = useMemo(() => {
    const group = groups.find((item) => item.id === groupFilter);
    return visibleTasks.filter(
      (task) => !group || task.path === group.path || task.path.startsWith(`${group.path}/`),
    );
  }, [visibleTasks, groups, groupFilter]);
  const availableStatuses = selected?.status === "archived" ? [...columns, "archived"] : columns;
  async function saveTaskBody(body: string) {
    setSaving(true);
    try {
      if (await saveBody(body)) setEditing(false);
    } finally {
      setSaving(false);
    }
  }
  const taskDrawerOpen = selected?.type === "task" && detail !== null;
  const taskDrawer = (
    <aside
      className={`dr task-detail-drawer ${taskDrawerOpen ? "on" : ""}`}
      aria-label="Task details"
      aria-hidden={!taskDrawerOpen}
      inert={!taskDrawerOpen}
    >
      {selected?.type === "task" && detail ? (
        <>
          <header className="task-drawer-head">
            <div>
              <p className="text-xs text-muted-foreground">
                {selected.id} · {selected.path}
              </p>
              <h2>{selected.name}</h2>
            </div>
            <div className="flex gap-2">
              <CustomSelect
                label="Task status"
                value={selected.status ?? "planned"}
                onValueChange={(status) => void updateTaskStatus(selected, status)}
                options={availableStatuses.map((status) => ({
                  value: status,
                  label: labels[status],
                  color:
                    status === "blocked"
                      ? "var(--bl)"
                      : status === "completed"
                        ? "var(--dn)"
                        : status === "in-progress"
                          ? "var(--ip)"
                          : "var(--pl)",
                }))}
              />
              {selected.status === "completed" &&
                !archivedTasks.some((task) => task.id === selected.id) && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      void setTaskHiddenFromRecent(selected, !selected.extra?.hidden_from_recent)
                    }
                  >
                    {selected.extra?.hidden_from_recent ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                    {selected.extra?.hidden_from_recent ? "Show in recent" : "Hide in recent"}
                  </Button>
                )}
              <Button
                variant="ghost"
                aria-label="Close task details"
                onClick={() => openRecord(null)}
              >
                <X className="size-4" />
              </Button>
              {!openSegment(selected) && selected.status !== "completed" && (
                <Button variant="outline" onClick={() => void startTaskTracking(selected)}>
                  Track changes
                </Button>
              )}
              <Button
                variant="outline"
                aria-label="Delete task"
                onClick={() => void deleteRecord({ id: selected.id, name: selected.name }, "task")}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  void setTaskArchived(
                    selected,
                    !archivedTasks.some((task) => task.id === selected.id),
                  )
                }
              >
                {archivedTasks.some((task) => task.id === selected.id) ? (
                  <ArchiveRestore className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )}
                {archivedTasks.some((task) => task.id === selected.id) ? "Restore" : "Archive"}
              </Button>
            </div>
          </header>
          <div className="task-detail-fields">
            <div>
              <span className="fld">Priority</span>
              <CustomSelect
                label="Task priority"
                value={selected.priority ?? "medium"}
                onValueChange={(priority) => void updateTaskPriority(selected, priority)}
                options={[
                  { value: "high", label: "High", color: "var(--bl)" },
                  { value: "medium", label: "Medium", color: "var(--ip)" },
                  { value: "low", label: "Low", color: "var(--pl)" },
                ]}
              />
            </div>
            <div>
              <span className="fld">Due date</span>
              <DatePicker
                label="Task due date"
                value={selected.due_at ?? ""}
                onValueChange={(dueDate) => void updateTaskDue(selected, dueDate || null)}
              />
            </div>
            <div>
              <span className="fld">Group</span>
              <p>
                {groups.find(
                  (item) =>
                    selected.path === item.path || selected.path.startsWith(`${item.path}/`),
                )?.name ??
                  selected.project ??
                  "Ungrouped"}
              </p>
            </div>
          </div>
          <div className="fld dh2 task-description-head" style={{ marginBottom: 6 }}>
            <span className="flex-1">
              Description · {checklist.completed}/{checklist.total} done
            </span>
            {editing ? (
              <>
                <Button
                  variant="outline"
                  className="btn2"
                  onClick={() => {
                    setDraft(detail.body);
                    setEditing(false);
                  }}
                >
                  <X className="size-4" /> Cancel
                </Button>
                <Button
                  className="btn2 pr"
                  disabled={saving || draft === detail.body}
                  onClick={() => void saveTaskBody(draft)}
                >
                  <Save className="size-4" /> {saving ? "Saving…" : "Save"}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="btn2"
                onClick={() => {
                  setDraft(detail.body);
                  setEditing(true);
                }}
              >
                <Pencil className="size-4" /> Edit
              </Button>
            )}
          </div>
          <TaskChanges taskId={selected.id} refreshKey={`${selected.contentHash}`} />
          {editing ? (
            <MarkdownEditor
              key={`${selected.id}:${detail.contentHash}`}
              value={draft}
              onError={setNotice}
              onChange={setDraft}
            />
          ) : (
            <MarkdownBody
              body={detail.body}
              className="mdb sm"
              linkContext={buildLinkContext(workspace, records, selected.path)}
              onNavigate={(href) => router.push(href)}
              knownWikiLinks={records.map((record) => record.id)}
              onWikiLink={(id) => {
                const record = records.find((item) => item.id === id);
                if (record) openRecord(record);
                else setNotice(`No file named ${id}`);
              }}
              onToggleTask={(index, checked) => {
                const next = toggleMarkdownCheckbox(detail.body, index, checked);
                if (next !== detail.body) void saveBody(next);
              }}
              taskUpdatesDisabled={saving}
            />
          )}
        </>
      ) : null}
    </aside>
  );
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
      {drawerHost ? createPortal(taskDrawer, drawerHost) : null}
    </div>
  );
}
