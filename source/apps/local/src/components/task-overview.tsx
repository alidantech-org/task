"use client";

import type { ChecklistSelector } from "@task/workspace/documents/checklist";
import { checklistProgress } from "@task/workspace/documents/checklist";
import { TaskChecklist } from "@/components/task-checklist";
import {
  describeDue,
  descriptionOf,
  formatDuration,
  inProgressMs,
  type StatusChange,
} from "@/lib/task-analytics";

type Segment = {
  ended_at?: string;
  summary?: { files: number; insertions: number; deletions: number };
};

type TaskOverviewProps = {
  body: string;
  status: string | undefined;
  dueAt: string | undefined;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  history: readonly StatusChange[] | undefined;
  segments: readonly Segment[];
  findings: number;
  groupName: string | undefined;
  disabled: boolean;
  onReadMore(): void;
  onShowChanges(): void;
  onChecklist(selector: ChecklistSelector, checked: boolean): void;
};

function shortDate(value: string | undefined): string {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(time)
    ? "—"
    : new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(time);
}

/** Description, tasks and analytics for a task, so the full Markdown is not needed for a quick look. */
export function TaskOverview(props: TaskOverviewProps) {
  const now = Date.now();
  const description = descriptionOf(props.body);
  const progress = checklistProgress(props.body);
  const percent =
    progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100);
  const due = describeDue(props.dueAt, props.status, now);
  const open = props.segments.at(-1);
  const recording = Boolean(open && !open.ended_at);
  const closed = props.segments.filter((segment) => segment.summary);
  const files = closed.reduce((sum, segment) => sum + (segment.summary?.files ?? 0), 0);
  const insertions = closed.reduce((sum, segment) => sum + (segment.summary?.insertions ?? 0), 0);
  const deletions = closed.reduce((sum, segment) => sum + (segment.summary?.deletions ?? 0), 0);
  const activity = [
    ...(props.history ?? []).map((change) => ({
      at: change.at,
      text: `${change.from} → ${change.to}`,
    })),
    ...(props.createdAt ? [{ at: props.createdAt, text: "Created" }] : []),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 6);
  return (
    <div className="task-overview">
      <section className="ov-desc">
        {description.text ? (
          <p>{description.text}</p>
        ) : (
          <p className="sub">No description yet. Add a Goal section in the Edit tab.</p>
        )}
        <button type="button" className="ov-link" onClick={props.onReadMore}>
          Read full details →
        </button>
      </section>
      <section>
        <h3 className="ov-title">Tasks</h3>
        <TaskChecklist body={props.body} disabled={props.disabled} onChange={props.onChecklist} />
      </section>
      <section>
        <h3 className="ov-title">Overview</h3>
        <div className="ov-tiles">
          <div className="ov-tile">
            <span>Progress</span>
            <strong>{progress.total === 0 ? "No steps" : `${percent}%`}</strong>
            <small>
              {progress.completed}/{progress.total} steps
            </small>
          </div>
          <div className="ov-tile">
            <span>In progress</span>
            <strong>{formatDuration(inProgressMs(props.history, props.status, now))}</strong>
            <small>{props.status === "in-progress" ? "running now" : "total so far"}</small>
          </div>
          <div className={`ov-tile tone-${due.tone}`}>
            <span>Due</span>
            <strong>{due.text}</strong>
            <small>{props.dueAt ?? "—"}</small>
          </div>
          <button type="button" className="ov-tile ov-button" onClick={props.onShowChanges}>
            <span>Changes</span>
            <strong>
              {recording
                ? "Recording"
                : files > 0
                  ? `${files} file${files === 1 ? "" : "s"}`
                  : "None"}
            </strong>
            <small>
              {files > 0
                ? `+${insertions} −${deletions}`
                : recording
                  ? "while in progress"
                  : "starts when in progress"}
            </small>
          </button>
          <div className={`ov-tile ${props.findings > 0 ? "tone-late" : "tone-ok"}`}>
            <span>Quality</span>
            <strong>{props.findings > 0 ? `${props.findings} to fix` : "Detailed"}</strong>
            <small>{props.groupName ?? "Ungrouped"}</small>
          </div>
        </div>
        <ul className="ov-activity">
          {activity.map((entry) => (
            <li key={`${entry.at}:${entry.text}`}>
              <span>{entry.text}</span>
              <time>{shortDate(entry.at)}</time>
            </li>
          ))}
          <li>
            <span>Last updated</span>
            <time>{shortDate(props.updatedAt)}</time>
          </li>
        </ul>
      </section>
    </div>
  );
}
