"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { PanelRightOpen } from "lucide-react";
import { dateKey } from "@/lib/calendar";

export type CalendarTask = {
  id: string;
  name: string;
  due_at?: string;
  start_at?: string;
  status?: string;
  archived?: boolean;
  project?: string;
  groupName?: string;
  priority?: string;
  assignee?: string;
  contentHash?: string;
  checklist?: { completed: number; total: number };
};

export function OpenButton({ onOpen, label }: { onOpen(): void; label: string }) {
  return (
    <button
      type="button"
      className="card-open"
      aria-label={label}
      title="Open task"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      <PanelRightOpen className="size-3.5" />
    </button>
  );
}

function CardContent({ task }: { task: CalendarTask }) {
  const priorityClass = task.priority === "high" ? "p-h" : task.priority === "low" ? "p-l" : "p-m";
  const priorityLabel = task.priority
    ? `${task.priority[0]?.toLocaleUpperCase() ?? ""}${task.priority.slice(1)} priority`
    : "";
  const overdue = Boolean(
    task.due_at && task.due_at < dateKey(new Date()) && task.status !== "completed",
  );
  const progress = task.checklist?.total
    ? Math.round((task.checklist.completed / task.checklist.total) * 100)
    : 0;
  return (
    <>
      <div className="ct" title={task.name}>
        {task.name}
      </div>
      <div className="cg" title={task.groupName}>
        {task.groupName ?? task.project ?? "Ungrouped"}
      </div>
      <div className="cf">
        {task.due_at ? (
          <span className={`due ${overdue ? "late" : ""}`}>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
              new Date(`${task.due_at}T12:00:00`),
            )}
          </span>
        ) : (
          <span />
        )}
        <span className="cf-end">
          {task.assignee && (
            <b className="av" title={task.assignee}>
              {task.assignee.slice(0, 2).toLocaleUpperCase()}
            </b>
          )}
          {task.priority && <i className={`pri ${priorityClass}`} title={priorityLabel} />}
        </span>
      </div>
      {task.checklist?.total ? (
        <div
          className="bar"
          role="progressbar"
          aria-label="Checklist completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <b style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </>
  );
}

/** What follows the pointer while a board card is dragged. */
export function BoardTaskPreview({ task }: { task: CalendarTask }) {
  return (
    <div className="card card-preview">
      <CardContent task={task} />
    </div>
  );
}

/** A board card that can be dragged to another column and reordered within its column. */
export function BoardTask({
  task,
  index,
  onSelect,
}: {
  task: CalendarTask;
  /** Position within the column, which is also the sortable group. */
  index: number;
  onSelect(): void;
}) {
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({
    id: `task:${task.id}`,
    index,
    group: task.status ?? "planned",
    type: "task",
    accept: "task",
    data: { taskId: task.id },
  });
  return (
    <div
      className={`card-shell ${isDragging ? "is-dragging" : ""} ${isDropTarget ? "is-target" : ""}`}
    >
      <button
        type="button"
        ref={(element) => {
          ref(element);
          handleRef(element);
        }}
        data-tid={task.id}
        className={`card w-full text-left ${isDragging ? "drag" : ""}`}
        aria-label={`Open task ${task.id}: ${task.name}`}
        onClick={onSelect}
      >
        <CardContent task={task} />
      </button>
      <OpenButton onOpen={onSelect} label={`Open task sheet for ${task.name}`} />
    </div>
  );
}
