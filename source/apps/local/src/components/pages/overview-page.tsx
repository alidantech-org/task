"use client";

import { useDroppable } from "@dnd-kit/react";
import { Calendar, Check, Clock3, Flame, Layers, Target, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { dateKey } from "@/lib/calendar";
import { completionWeek, getCompletionTimestamp, getRecentCompletedTasks } from "@/lib/overview";

type DayTargetProps = {
  date: Date;
  count: number;
  onOpen(): void;
};

function DayTarget({ date, count, onOpen }: DayTargetProps) {
  const key = dateKey(date);
  const { ref, isDropTarget } = useDroppable({ id: `date:${key}`, data: { date: key } });
  const today = key === dateKey(new Date());
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      title={`${count} due`}
      className={`wd ${today ? "tdy" : ""} ${isDropTarget ? "over" : ""}`}
    >
      <small>{date.toLocaleDateString("en", { weekday: "short" })}</small>
      <b>{date.getDate()}</b>
      <s aria-hidden="true">
        {[0, 1, 2, 3].slice(0, Math.min(count, 4)).map((dot) => (
          <i key={`${key}-${dot}`} />
        ))}
      </s>
    </button>
  );
}

function timeAgo(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (!Number.isFinite(minutes)) return "Completed";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

export function OverviewPage() {
  const router = useRouter();
  const { workspace, tasks, allTasks, openRecord, updateTaskStatus } = useWorkspaceApp();
  const active = tasks.filter((task) => task.status !== "completed" && task.status !== "archived");
  const todayKey = dateKey(new Date());
  const blocked = active.filter((task) => task.status === "blocked");
  const overdue = active.filter((task) => task.due_at && task.due_at < todayKey);
  const dueNow = active.filter((task) => task.due_at && task.due_at <= todayKey);
  const inProgress = active.filter((task) => task.status === "in-progress");
  const focus = [
    ...new Map([...blocked, ...dueNow, ...inProgress].map((task) => [task.id, task])).values(),
  ]
    .sort((left, right) => {
      const rank = (status?: string, due?: string) =>
        status === "blocked" ? 0 : due && due <= todayKey ? 1 : status === "in-progress" ? 2 : 3;
      return rank(left.status, left.due_at) - rank(right.status, right.due_at);
    })
    .slice(0, 6);
  const recentlyFinished = getRecentCompletedTasks(allTasks, 4);
  const week = completionWeek(allTasks);
  const completedToday = week.find((day) => day.date === todayKey)?.count ?? 0;
  const totalProgress = completedToday + focus.length;
  const progress = totalProgress ? Math.round((completedToday / totalProgress) * 100) : 100;
  const statusCounts = [
    {
      key: "planned",
      label: "Planned",
      value: active.filter((task) => task.status === "planned").length,
      color: "var(--pl)",
    },
    { key: "in-progress", label: "In progress", value: inProgress.length, color: "var(--ip)" },
    { key: "blocked", label: "Blocked", value: blocked.length, color: "var(--bl)" },
    {
      key: "completed",
      label: "Completed",
      value: tasks.filter((task) => task.status === "completed").length,
      color: "var(--dn)",
    },
  ];
  const statusTotal = Math.max(
    1,
    statusCounts.reduce((sum, item) => sum + item.value, 0),
  );
  let offset = 0;
  const donut = statusCounts.map((item) => {
    const length = (item.value / statusTotal) * 251.3;
    const segment = (
      <circle
        key={item.key}
        className="dseg"
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke={item.color}
        strokeWidth="12"
        strokeDasharray={`${length} ${251.3 - length}`}
        strokeDashoffset={-offset}
        transform="rotate(-90 50 50)"
      />
    );
    offset += length;
    return segment;
  });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());
  const nextDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return date;
  });
  const chartMax = Math.max(1, ...week.map((day) => day.count));
  const statusColor = (status?: string) =>
    status === "blocked"
      ? "var(--bl)"
      : status === "in-progress"
        ? "var(--ip)"
        : status === "completed"
          ? "var(--dn)"
          : "var(--pl)";
  const statusLabel = (status?: string) =>
    status === "in-progress"
      ? "In progress"
      : status === "blocked"
        ? "Blocked"
        : status === "completed"
          ? "Completed"
          : "Planned";
  const header = (Icon: typeof Target, title: string, action?: React.ReactNode) => (
    <div className="sh2">
      <i className="hi">
        <Icon className="size-[18px]" />
      </i>
      <h2>{title}</h2>
      {action}
    </div>
  );

  return (
    <div className="overview-match">
      <section className="hero2">
        <div className="hz">
          <p>
            {today} · {workspace?.projectName ?? "Workspace"}
          </p>
          <h1>{greeting}</h1>
          <p className="hs">
            {focus.length
              ? `${focus.length} to focus on${overdue.length ? `, ${overdue.length} overdue` : ""}. ${completedToday} finished today.`
              : "All clear. Nothing needs you right now."}
          </p>
          <div className="hc">
            <span>
              <Flame />
              {blocked.length} blocked
            </span>
            <span>
              <Clock3 />
              {inProgress.length} in progress
            </span>
            <span>
              <Calendar />
              {active.filter((task) => task.due_at).length} scheduled
            </span>
          </div>
        </div>
        <div className="hr">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--soft)" strokeWidth="9" />
            <circle
              className="rg"
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="var(--acc)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${(progress / 100) * 276.5} 276.5`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div>
            <b>{progress}%</b>
            <small>today</small>
          </div>
        </div>
      </section>

      <div className="ovg">
        <div className="stk">
          <section className="box">
            {header(Target, "Focus now")}
            {focus.map((task) => (
              <div className="tr" data-fid={task.id} key={task.id}>
                <button
                  type="button"
                  className="chk"
                  aria-label={`Mark ${task.name} done`}
                  onClick={() => void updateTaskStatus(task, "completed")}
                >
                  <Check />
                </button>
                <button type="button" className="t" onClick={() => openRecord(task)}>
                  <b>{task.name}</b>
                  <small>
                    {task.id} · {task.groupName ?? "Ungrouped"}
                    {task.due_at
                      ? ` · ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${task.due_at}T12:00:00`))}`
                      : ""}
                  </small>
                </button>
                <span
                  className="pill"
                  style={{
                    background: `color-mix(in srgb, ${statusColor(task.status)} 16%, transparent)`,
                  }}
                >
                  <i style={{ background: statusColor(task.status) }} />
                  {statusLabel(task.status)}
                </span>
              </div>
            ))}
            {focus.length === 0 && <p className="sub">Nothing open. Enjoy the quiet.</p>}
          </section>

          <section className="box">
            {header(
              Calendar,
              "Next 7 days",
              <button
                type="button"
                className="btn2"
                onClick={() => router.push(`/calendar?date=${todayKey}`)}
              >
                Open calendar
              </button>,
            )}
            <div className="wk7">
              {nextDays.map((date) => (
                <DayTarget
                  key={dateKey(date)}
                  date={date}
                  count={active.filter((task) => task.due_at === dateKey(date)).length}
                  onOpen={() => {
                    router.push(`/calendar?date=${dateKey(date)}`);
                  }}
                />
              ))}
            </div>
            <p className="sub" style={{ margin: "10px 4px 0" }}>
              Drop a task on a day to schedule it.
            </p>
          </section>

          <section className="box">
            {header(Check, "Recently finished")}
            {recentlyFinished.map((task) => (
              <div className="tr dn" key={task.id}>
                <span className="chk d">
                  <Check />
                </span>
                <button type="button" className="t" onClick={() => openRecord(task)}>
                  <b>{task.name}</b>
                  <small>
                    {task.id} · {timeAgo(getCompletionTimestamp(task))}
                  </small>
                </button>
              </div>
            ))}
            {recentlyFinished.length === 0 && <p className="sub">Nothing yet.</p>}
          </section>
        </div>

        <div className="stk">
          <section className="box">
            {header(TrendingUp, "Finished this week")}
            <div
              className="chart"
              role="img"
              aria-label={`Completions per day: ${week.map((day) => day.count).join(", ")}`}
            >
              {week.map((day) => (
                <div className={day.date === todayKey ? "hot" : ""} key={day.date}>
                  <em>{day.count || ""}</em>
                  <s style={{ height: `${Math.max(6, (day.count / chartMax) * 110)}px` }} />
                  {new Intl.DateTimeFormat("en", { weekday: "short" }).format(
                    new Date(`${day.date}T12:00:00`),
                  )}
                </div>
              ))}
            </div>
          </section>
          <section className="box">
            {header(Layers, "Where things stand")}
            <div className="dn2">
              <svg viewBox="0 0 100 100" aria-label="Task status breakdown">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--soft)" strokeWidth="12" />
                {donut}
              </svg>
              <div className="dc2">
                <b>{tasks.length}</b>
                <small>tasks</small>
              </div>
              <div className="lg">
                {statusCounts.map((item) => (
                  <span key={item.key}>
                    <i style={{ background: item.color }} />
                    {item.label}
                    <b>{item.value}</b>
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
