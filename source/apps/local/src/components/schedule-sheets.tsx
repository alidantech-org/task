"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { type RecordItem, useWorkspaceApp } from "@/components/layout/app-layout";
import { SheetShell } from "@/components/sheet-shell";
import { DatePicker } from "@/components/ui/date-picker";
import { CustomSelect } from "@/components/ui/select";
import { sortBoard } from "@/lib/board-order";
import { dateKey, weekGrid } from "@/lib/calendar";
import { groupForTask } from "@/lib/group";
import { type Totals, totalsOf } from "@/lib/schedule";
import { describeDue } from "@/lib/task-analytics";

const statuses = [
  { value: "planned", label: "Planned", color: "var(--pl)" },
  { value: "in-progress", label: "In progress", color: "var(--ip)" },
  { value: "blocked", label: "Blocked", color: "var(--bl)" },
  { value: "completed", label: "Completed", color: "var(--dn)" },
] as const;

function parse(date: string): Date {
  return new Date(`${date}T12:00:00`);
}
function longDate(date: string): string {
  return parse(date).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" });
}
function shiftDay(date: string, days: number): string {
  const next = parse(date);
  next.setDate(next.getDate() + days);
  return dateKey(next);
}

function Tiles({ totals }: { totals: Totals }) {
  return (
    <div className="ov-tiles sch-tiles">
      <div className="ov-tile">
        <span>Tasks</span>
        <strong>{totals.count}</strong>
        <small>scheduled</small>
      </div>
      <div className="ov-tile tone-ok">
        <span>Done</span>
        <strong>{totals.done}</strong>
        <small>{totals.count ? `${Math.round((totals.done / totals.count) * 100)}%` : "—"}</small>
      </div>
      <div className={`ov-tile ${totals.overdue ? "tone-late" : ""}`}>
        <span>Overdue</span>
        <strong>{totals.overdue}</strong>
        <small>{totals.overdue ? "needs attention" : "none"}</small>
      </div>
      <div className="ov-tile">
        <span>Estimate</span>
        <strong>{totals.estimate || "—"}</strong>
        <small>points</small>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onOpen,
  showDate,
}: {
  task: RecordItem;
  onOpen(task: RecordItem): void;
  showDate: boolean;
}) {
  const { updateTaskStatus, updateTaskDue } = useWorkspaceApp();
  const due = describeDue(task.due_at, task.status, Date.now());
  return (
    <li className="sch-row">
      <CustomSelect
        compact
        label="Status"
        value={task.status ?? "planned"}
        options={statuses}
        onValueChange={(status) => void updateTaskStatus(task, status)}
      />
      <button type="button" className="sch-title" onClick={() => onOpen(task)} title={task.name}>
        <span>{task.name}</span>
        <small>{task.groupName ?? "Ungrouped"}</small>
      </button>
      {task.priority && (
        <i
          className={`pri ${task.priority === "high" ? "p-h" : task.priority === "low" ? "p-l" : "p-m"}`}
          title={`${task.priority} priority`}
        />
      )}
      {task.assignee && <b className="av">{task.assignee.slice(0, 2).toLocaleUpperCase()}</b>}
      {showDate && <span className={`sch-due due-${due.tone}`}>{due.text}</span>}
      <DatePicker
        compact
        label="Reschedule"
        value={task.due_at ?? ""}
        onValueChange={(date) => void updateTaskDue(task, date || null)}
      />
    </li>
  );
}

function useScheduled(dates: readonly string[]) {
  const { tasks, allGroups } = useWorkspaceApp();
  return useMemo(() => {
    const wanted = new Set(dates);
    const rank = (task: RecordItem) => {
      const group = groupForTask(task, allGroups);
      const position = group ? allGroups.findIndex((item) => item.id === group.id) : -1;
      return position < 0 ? Number.MAX_SAFE_INTEGER : position;
    };
    return sortBoard(
      tasks.filter((task) => task.due_at && wanted.has(task.due_at) && task.status !== "archived"),
      rank,
    );
  }, [tasks, allGroups, dates]);
}

function Navigation({
  label,
  onMove,
  onToday,
}: {
  label: string;
  onMove(direction: -1 | 1): void;
  onToday(): void;
}) {
  return (
    <div className="sch-nav">
      <button
        type="button"
        className="sch-step"
        aria-label={`Previous ${label}`}
        onClick={() => onMove(-1)}
      >
        <ChevronLeft className="size-4" />
      </button>
      <button type="button" className="sch-today" onClick={onToday}>
        Today
      </button>
      <button
        type="button"
        className="sch-step"
        aria-label={`Next ${label}`}
        onClick={() => onMove(1)}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

/** Everything due on one day, manageable without leaving the calendar. */
export function DaySheet({
  date,
  onDate,
  onClose,
  onOpenTask,
  onCreate,
}: {
  date: string;
  onDate(date: string): void;
  onClose(): void;
  onOpenTask(task: RecordItem): void;
  onCreate(date: string): void;
}) {
  const scheduled = useScheduled([date]);
  const totals = totalsOf(scheduled);
  const meta: ReactNode = `${totals.count} task${totals.count === 1 ? "" : "s"} · ${totals.done} done${totals.overdue ? ` · ${totals.overdue} overdue` : ""}`;
  return (
    <SheetShell
      storageKey="day-sheet-width"
      title={longDate(date)}
      meta={meta}
      onClose={onClose}
      subhead={
        <>
          <Navigation
            label="day"
            onMove={(direction) => onDate(shiftDay(date, direction))}
            onToday={() => onDate(dateKey(new Date()))}
          />
          <button type="button" className="sch-add" onClick={() => onCreate(date)}>
            <Plus className="size-4" /> New task
          </button>
        </>
      }
    >
      <Tiles totals={totals} />
      {scheduled.length === 0 ? (
        <p className="sub">
          Nothing is scheduled for this day. Drag a task here from the calendar or add one.
        </p>
      ) : (
        <ul className="sch-list">
          {scheduled.map((task) => (
            <TaskRow key={task.id} task={task} onOpen={onOpenTask} showDate={false} />
          ))}
        </ul>
      )}
    </SheetShell>
  );
}

/** A week at a glance, with each day's tasks and a way into any single day. */
export function WeekSheet({
  date,
  onDate,
  onClose,
  onOpenDay,
  onOpenTask,
  onCreate,
}: {
  date: string;
  onDate(date: string): void;
  onClose(): void;
  onOpenDay(date: string): void;
  onOpenTask(task: RecordItem): void;
  onCreate(date: string): void;
}) {
  const days = useMemo(() => weekGrid(parse(date)).map(dateKey), [date]);
  const scheduled = useScheduled(days);
  const totals = totalsOf(scheduled);
  const first = parse(days[0] ?? date);
  const last = parse(days[6] ?? date);
  const range = `${first.toLocaleDateString("en", { month: "short", day: "numeric" })} – ${last.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;
  return (
    <SheetShell
      storageKey="week-sheet-width"
      title={`Week of ${range}`}
      meta={`${totals.count} task${totals.count === 1 ? "" : "s"} · ${totals.done} done${totals.overdue ? ` · ${totals.overdue} overdue` : ""}`}
      onClose={onClose}
      subhead={
        <Navigation
          label="week"
          onMove={(direction) => onDate(shiftDay(date, direction * 7))}
          onToday={() => onDate(dateKey(new Date()))}
        />
      }
    >
      <Tiles totals={totals} />
      {days.map((day) => {
        const tasks = scheduled.filter((task) => task.due_at === day);
        return (
          <section key={day} className="sch-day">
            <header>
              <button type="button" onClick={() => onOpenDay(day)} title="Open this day">
                {parse(day).toLocaleDateString("en", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </button>
              <span className="sub">{tasks.length}</span>
              <span className="gap" />
              <button
                type="button"
                className="sch-add small"
                aria-label={`Add task on ${day}`}
                onClick={() => onCreate(day)}
              >
                <Plus className="size-3.5" />
              </button>
            </header>
            {tasks.length === 0 ? (
              <p className="sub sch-empty">Nothing scheduled.</p>
            ) : (
              <ul className="sch-list">
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} onOpen={onOpenTask} showDate={false} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </SheetShell>
  );
}
