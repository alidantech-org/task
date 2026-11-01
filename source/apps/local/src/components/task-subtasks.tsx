"use client";

import { useState } from "react";
import type { RecordItem } from "@/components/layout/app-layout";

const dots: Record<string, string> = {
  planned: "var(--pl)",
  "in-progress": "var(--ip)",
  blocked: "var(--bl)",
  completed: "var(--dn)",
};

/** Child tasks of this task, with a progress rollup and a quick way to add one. */
export function TaskSubtasks({
  task,
  subtasks,
  parent,
  onOpen,
  onAdd,
}: {
  task: RecordItem;
  subtasks: readonly RecordItem[];
  parent: RecordItem | undefined;
  onOpen(task: RecordItem): void;
  onAdd(title: string): Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const done = subtasks.filter((child) => child.status === "completed").length;
  const percent = subtasks.length ? Math.round((done / subtasks.length) * 100) : 0;
  return (
    <div className="task-subtasks">
      {parent && (
        <p className="sub">
          Subtask of{" "}
          <button type="button" className="ov-link" onClick={() => onOpen(parent)}>
            {parent.name}
          </button>
        </p>
      )}
      {subtasks.length > 0 && (
        <div className="check-summary">
          <div className="min-w-0 flex-1">
            <strong>
              {done}/{subtasks.length} subtasks done
            </strong>
            <div
              className="check-progress"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>
      )}
      <ul className="sub-list">
        {subtasks.map((child) => (
          <li key={child.id}>
            <i className="sub-dot" style={{ background: dots[child.status ?? "planned"] }} />
            <button type="button" className="sub-title" onClick={() => onOpen(child)}>
              {child.name}
            </button>
            <small className="sub">{child.status}</small>
          </li>
        ))}
      </ul>
      {subtasks.length === 0 && <p className="sub">No subtasks yet.</p>}
      <form
        className="sub-add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim() || busy) return;
          setBusy(true);
          void onAdd(title.trim())
            .then((ok) => ok && setTitle(""))
            .finally(() => setBusy(false));
        }}
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={`Add a subtask to "${task.name.slice(0, 40)}"`}
          aria-label="New subtask title"
        />
        <button type="submit" disabled={busy || !title.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}
