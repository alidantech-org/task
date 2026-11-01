"use client";

import { useDraggable, useDroppable } from "@dnd-kit/react";
import { ChevronLeft, PanelRight, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { type CalendarTask, OpenButton } from "@/components/board-task";
import { dateKey, monthGrid, weekGrid } from "@/lib/calendar";
import { restartSectionEntrance } from "@/lib/entrance";
import { isOneOf, usePersistentState } from "@/lib/persistent-state";

function statusClass(status?: string): string {
  return `s-${status ?? "planned"}`;
}

function CalendarTaskCard({ task, onSelect }: { task: CalendarTask; onSelect(): void }) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { taskId: task.id },
  });
  return (
    <div
      ref={ref}
      data-tid={task.id}
      className={`mini ${statusClass(task.status)} ${isDragging ? "drag" : ""}`}
      title={task.name}
    >
      <button
        type="button"
        ref={handleRef}
        onClick={onSelect}
        className="w-full truncate text-left"
      >
        {task.name}
      </button>
      <OpenButton onOpen={onSelect} label={`Open task sheet for ${task.name}`} />
    </div>
  );
}

function DateCell({
  date,
  inMonth,
  tasks,
  week,
  onCreate,
  onSelect,
}: {
  date: Date;
  inMonth: boolean;
  tasks: CalendarTask[];
  week: boolean;
  onCreate(date: string): void;
  onSelect(task: CalendarTask): void;
}) {
  const key = dateKey(date);
  const { ref, isDropTarget } = useDroppable({ id: `date:${key}`, data: { date: key } });
  const maximum = week ? 9 : 3;
  return (
    <div
      ref={ref}
      className={`day ${week ? "wk" : ""} ${key === dateKey(new Date()) ? "tdy" : ""} ${!week && !inMonth ? "oth" : ""} ${isDropTarget ? "over" : ""}`}
      data-dropday={key}
    >
      <div className="xd">
        <b>{date.getDate()}</b>
        <button
          type="button"
          className="add"
          aria-label={`Add task on ${date.toLocaleDateString("en", { month: "long", day: "numeric" })}`}
          onClick={() => onCreate(key)}
        >
          <Plus />
        </button>
      </div>
      {tasks.slice(0, maximum).map((task) => (
        <CalendarTaskCard key={task.id} task={task} onSelect={() => onSelect(task)} />
      ))}
      {tasks.length > maximum && <span className="more">+{tasks.length - maximum} more</span>}
    </div>
  );
}

function UnscheduledTray({
  id,
  tasks,
  onSelect,
}: {
  id: string;
  tasks: CalendarTask[];
  onSelect(task: CalendarTask): void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: "calendar:unscheduled",
    data: { clearDate: true },
  });
  return (
    <aside id={id} ref={ref} className={`unp ${isDropTarget ? "over" : ""}`} data-dropday="">
      <h2>Unscheduled</h2>
      <p className="sub" style={{ margin: "2px 0 8px" }}>
        Drag onto a day, or drop here to clear a date.
      </p>
      {tasks.map((task) => (
        <CalendarTaskCard key={task.id} task={task} onSelect={() => onSelect(task)} />
      ))}
      {tasks.length === 0 && <p className="sub">Everything has a date.</p>}
    </aside>
  );
}

export function CalendarView({
  tasks,
  initialDate,
  onCreate,
  onSelect,
}: {
  tasks: CalendarTask[];
  initialDate?: string;
  onCreate(date: string): void;
  onSelect(task: CalendarTask): void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedDate = initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : null;
  const [cursor, setCursor] = useState(() =>
    requestedDate ? new Date(`${requestedDate}T12:00:00`) : new Date(),
  );
  const appliedRequestedDate = useRef(requestedDate);
  const pendingRequestedDate = useRef<string | null>(null);
  const [mode, setMode] = usePersistentState<"month" | "week">(
    "calendar:mode",
    "month",
    isOneOf(["month", "week"] as const),
  );
  const [unscheduledVisibility, setUnscheduledVisibility] = usePersistentState<boolean | null>(
    "calendar:tray",
    null,
    (value): value is boolean | null => value === null || typeof value === "boolean",
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: Restart the section entrance when switching calendar modes.
  useEffect(() => {
    restartSectionEntrance(document.querySelector<HTMLElement>(".body"));
  }, [mode]);
  useEffect(() => {
    if (requestedDate === appliedRequestedDate.current) return;
    appliedRequestedDate.current = requestedDate;
    if (!requestedDate) return;
    pendingRequestedDate.current = requestedDate;
    setCursor(new Date(`${requestedDate}T12:00:00`));
  }, [requestedDate]);
  useEffect(() => {
    const selectedDate = dateKey(cursor);
    const pendingDate = pendingRequestedDate.current;
    if (pendingDate && pendingDate !== selectedDate) return;
    if (pendingDate === selectedDate) pendingRequestedDate.current = null;
    if (searchParams.get("date") === selectedDate) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date", selectedDate);
    router.replace(`/calendar?${nextParams.toString()}`, { scroll: false });
  }, [cursor, router, searchParams]);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const grid = useMemo(
    () => (mode === "month" ? monthGrid(cursor) : weekGrid(cursor)),
    [cursor, mode],
  );
  const scheduled = tasks.filter((task) => task.due_at);
  const unscheduled = tasks.filter((task) => !task.due_at && task.status !== "completed");
  const showUnscheduled = unscheduledVisibility ?? unscheduled.length > 0;
  const title =
    mode === "month"
      ? cursor.toLocaleDateString("en", { month: "long", year: "numeric" })
      : `${grid[0]?.toLocaleDateString("en", { month: "short", day: "numeric" })} – ${grid[6]?.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;
  function movePeriod(amount: number) {
    setCursor((date) =>
      mode === "month"
        ? new Date(date.getFullYear(), date.getMonth() + amount, 1)
        : new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount * 7),
    );
  }
  return (
    <div className="calendar-match">
      <header className="calh">
        <h1>{title}</h1>
        <button
          type="button"
          className="ib"
          aria-label="Previous period"
          onClick={() => movePeriod(-1)}
        >
          <ChevronLeft />
        </button>
        <button type="button" className="btn2" onClick={() => setCursor(new Date())}>
          Today
        </button>
        <button
          type="button"
          className="ib nx"
          aria-label="Next period"
          onClick={() => movePeriod(1)}
        >
          <ChevronLeft />
        </button>
        <span className="gap" />
        <button
          type="button"
          className={`btn2 calendar-unscheduled-toggle ${showUnscheduled ? "on" : ""}`}
          aria-label={`${showUnscheduled ? "Hide" : "Show"} unscheduled tasks`}
          aria-expanded={showUnscheduled}
          aria-controls={showUnscheduled ? "calendar-unscheduled-tray" : undefined}
          title={`${showUnscheduled ? "Hide" : "Show"} unscheduled tasks`}
          onClick={() => setUnscheduledVisibility(!showUnscheduled)}
        >
          <PanelRight className="size-4" />
          <span>Unscheduled</span>
          <small className="calendar-unscheduled-count">{unscheduled.length}</small>
        </button>
        <fieldset className="seg" aria-label="Calendar view">
          {(["month", "week"] as const).map((view) => (
            <button
              type="button"
              key={view}
              className={mode === view ? "on" : ""}
              onClick={() => setMode(view)}
            >
              {view === "month" ? "Month" : "Week"}
            </button>
          ))}
        </fieldset>
      </header>
      <div className={`calw ${showUnscheduled ? "" : "without-unscheduled"}`}>
        <section className="cal" aria-label={title}>
          {days.map((day) => (
            <div className="dh" key={day}>
              {day}
            </div>
          ))}
          {grid.map((date) => (
            <DateCell
              key={dateKey(date)}
              date={date}
              inMonth={date.getMonth() === cursor.getMonth()}
              tasks={scheduled.filter((task) => task.due_at === dateKey(date))}
              week={mode === "week"}
              onCreate={onCreate}
              onSelect={onSelect}
            />
          ))}
        </section>
        {showUnscheduled && (
          <UnscheduledTray id="calendar-unscheduled-tray" tasks={unscheduled} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}

export function StatusDropZone({ status, children }: { status: string; children: ReactNode }) {
  const { ref, isDropTarget } = useDroppable({ id: `status:${status}`, data: { status } });
  return (
    <fieldset
      ref={ref}
      aria-label={`Drop tasks in ${status}`}
      className={`col ${isDropTarget ? "over" : ""}`}
    >
      {children}
    </fieldset>
  );
}

export { BoardTask, type CalendarTask } from "@/components/board-task";
