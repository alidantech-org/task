"use client";

import { useDraggable, useDroppable } from "@dnd-kit/react";
import { Button } from "@task/ui";
import { ChevronLeft, ChevronRight, GripVertical, Plus } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { dateKey, monthGrid, weekGrid } from "@/lib/calendar";

export type CalendarTask = {
  id: string;
  name: string;
  due_at?: string;
  start_at?: string;
  status?: string;
};

function CalendarTaskCard({ task, onSelect }: { task: CalendarTask; onSelect(): void }) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { taskId: task.id },
  });
  return (
    <div
      ref={ref}
      className={`group flex min-w-0 items-center gap-1 rounded-md border bg-card px-1.5 py-1 text-left text-[11px] ${isDragging ? "opacity-40" : ""}`}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 truncate text-left">
        {task.name}
      </button>
      <button
        type="button"
        ref={handleRef}
        aria-label={`Drag ${task.name}`}
        className="cursor-grab rounded p-0.5 text-muted-foreground opacity-60 hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-3" />
      </button>
    </div>
  );
}

function DateCell({
  date,
  inMonth,
  tasks,
  compact,
  onCreate,
  onSelect,
}: {
  date: Date;
  inMonth: boolean;
  tasks: CalendarTask[];
  compact: boolean;
  onCreate(date: string): void;
  onSelect(task: CalendarTask): void;
}) {
  const key = dateKey(date);
  const { ref, isDropTarget } = useDroppable({ id: `date:${key}`, data: { date: key } });
  return (
    // biome-ignore lint/a11y/useSemanticElements: Grid cells are appropriate in the ARIA calendar grid.
    <div
      ref={ref}
      role="gridcell"
      tabIndex={0}
      aria-label={date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}
      className={`min-h-28 border-b border-r p-1.5 transition-colors ${!inMonth && compact ? "bg-muted/30 text-muted-foreground" : "bg-background"} ${isDropTarget ? "bg-primary/10 ring-2 ring-inset ring-primary/50" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`grid size-6 place-items-center rounded-full text-xs ${key === dateKey(new Date()) ? "bg-primary font-semibold text-primary-foreground" : ""}`}
        >
          {date.getDate()}
        </span>
        <button
          type="button"
          aria-label={`Create task on ${key}`}
          onClick={() => onCreate(key)}
          className="rounded p-1 text-muted-foreground opacity-50 hover:bg-accent hover:opacity-100"
        >
          <Plus className="size-3" />
        </button>
      </div>
      <div className="space-y-1">
        {tasks.slice(0, compact ? 2 : 4).map((task) => (
          <CalendarTaskCard key={task.id} task={task} onSelect={() => onSelect(task)} />
        ))}
        {tasks.length > (compact ? 2 : 4) && (
          <p className="px-1 text-[10px] text-muted-foreground">
            +{tasks.length - (compact ? 2 : 4)} more
          </p>
        )}
      </div>
    </div>
  );
}

export function CalendarView({
  tasks,
  onCreate,
  onSelect,
}: {
  tasks: CalendarTask[];
  onCreate(date: string): void;
  onSelect(task: CalendarTask): void;
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [mode, setMode] = useState<"month" | "week">("month");
  const [showPlanning, setShowPlanning] = useState(true);
  const grid = useMemo(
    () => (mode === "month" ? monthGrid(cursor) : weekGrid(cursor)),
    [cursor, mode],
  );
  const scheduled = tasks.filter((task) => task.due_at);
  const unscheduled = tasks.filter((task) => !task.due_at);
  function movePeriod(amount: number) {
    setCursor((date) =>
      mode === "month"
        ? new Date(date.getFullYear(), date.getMonth() + amount, 1)
        : new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount * 7),
    );
  }
  function selectTask(task: CalendarTask) {
    onSelect(task);
  }
  return (
    <div
      className={`mt-5 grid gap-4 ${showPlanning ? "xl:grid-cols-[minmax(0,1fr)_250px]" : "grid-cols-1"}`}
    >
      <section className="min-w-0 border-y border-border/70 bg-transparent">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3 sm:p-4">
          <div>
            <h2 className="font-semibold">
              {mode === "month"
                ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
                : `${grid[0]?.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${grid[6]?.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
            </h2>
            <p className="text-xs text-muted-foreground">Drag tasks to schedule or move them.</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous period"
              onClick={() => movePeriod(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next period"
              onClick={() => movePeriod(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <span className="ml-2 flex rounded-lg bg-muted p-1">
              <Button
                variant={mode === "month" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMode("month")}
              >
                Month
              </Button>
              <Button
                variant={mode === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMode("week")}
              >
                Week
              </Button>
            </span>
          </div>
        </div>
        <div className="grid grid-cols-7 border-l text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="border-b border-r py-2">
              {day}
            </div>
          ))}
        </div>
        <div
          className={`grid grid-cols-7 border-l ${mode === "month" ? "" : "[&>div]:min-h-[420px]"}`}
        >
          {grid.map((date) => (
            <DateCell
              key={dateKey(date)}
              date={date}
              inMonth={date.getMonth() === cursor.getMonth()}
              compact={mode === "month"}
              tasks={scheduled.filter((task) => task.due_at === dateKey(date))}
              onCreate={onCreate}
              onSelect={selectTask}
            />
          ))}
        </div>
      </section>
      <aside className="border-l border-border/60 bg-transparent px-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Planning</h3>
            <p className="text-xs text-muted-foreground">Unscheduled tasks</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowPlanning((value) => !value)}>
            {showPlanning ? "Collapse" : "Expand"}
          </Button>
        </div>
        {showPlanning && (
          <>
            <div className="mt-4 grid grid-cols-7 gap-1">
              {monthGrid(cursor).map((date) => (
                <button
                  type="button"
                  key={dateKey(date)}
                  onClick={() => setCursor(date)}
                  className={`grid aspect-square place-items-center rounded text-[10px] hover:bg-accent ${date.getMonth() !== cursor.getMonth() ? "text-muted-foreground/40" : ""} ${dateKey(date) === dateKey(cursor) ? "bg-primary text-primary-foreground" : ""}`}
                >
                  {date.getDate()}
                </button>
              ))}
            </div>
            <div className="my-4 border-t" />
            <p className="mb-2 text-xs font-medium">
              No due date <span className="text-muted-foreground">{unscheduled.length}</span>
            </p>
            <div className="space-y-2">
              {unscheduled.map((task) => (
                <CalendarTaskCard key={task.id} task={task} onSelect={() => onSelect(task)} />
              ))}
              {unscheduled.length === 0 && (
                <p className="text-xs text-muted-foreground">All tasks have due dates.</p>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export function BoardTask({ task, onSelect }: { task: CalendarTask; onSelect(): void }) {
  return <CalendarTaskCard task={task} onSelect={onSelect} />;
}

export function StatusDropZone({ status, children }: { status: string; children: ReactNode }) {
  const { ref, isDropTarget } = useDroppable({ id: `status:${status}`, data: { status } });
  return (
    <fieldset
      ref={ref}
      aria-label={`Drop tasks in ${status}`}
      className={`min-h-40 space-y-2 rounded-xl p-1 transition-colors ${isDropTarget ? "bg-primary/10 ring-2 ring-primary/40" : ""}`}
    >
      {children}
    </fieldset>
  );
}
