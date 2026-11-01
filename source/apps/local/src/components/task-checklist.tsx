"use client";

import { type ChecklistSelector, parseChecklist } from "@task/workspace/documents/checklist";
import { Check } from "lucide-react";

type TaskChecklistProps = {
  body: string;
  disabled: boolean;
  onChange(selector: ChecklistSelector, checked: boolean): void;
};

function Progress({ completed, total }: { completed: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div
      className="check-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
      aria-label={`${completed} of ${total} done`}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Checkboxes from the task Markdown, grouped under their headings, editable without opening the file. */
export function TaskChecklist({ body, disabled, onChange }: TaskChecklistProps) {
  const checklist = parseChecklist(body);
  if (checklist.total === 0)
    return (
      <p className="sub">
        This task has no checkboxes yet. Add <code>- [ ] step</code> lines under headings in the
        Edit tab; each heading becomes a titled group here.
      </p>
    );
  return (
    <div className="task-checklist">
      <div className="check-summary">
        <div className="min-w-0 flex-1">
          <strong>
            {checklist.completed}/{checklist.total} done
          </strong>
          <Progress completed={checklist.completed} total={checklist.total} />
        </div>
        <button
          type="button"
          className="chip"
          disabled={disabled}
          onClick={() => onChange({ all: true }, true)}
        >
          Check all
        </button>
        <button
          type="button"
          className="chip"
          disabled={disabled}
          onClick={() => onChange({ all: true }, false)}
        >
          Uncheck all
        </button>
      </div>
      {checklist.groups.map((group) => {
        const done = group.items.filter((item) => item.checked).length;
        const indexes = group.items.map((item) => item.index);
        return (
          <section key={`${group.line}:${group.heading}`} className="check-group">
            <header>
              <h3>{group.heading || "General"}</h3>
              <span className="sub">
                {done}/{group.items.length}
              </span>
              <span className="gap" />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange({ items: indexes }, done !== group.items.length)}
              >
                {done === group.items.length ? "Uncheck group" : "Check group"}
              </button>
            </header>
            <Progress completed={done} total={group.items.length} />
            <ul>
              {group.items.map((item) => (
                <li key={item.index}>
                  <label className={item.checked ? "check-row done" : "check-row"}>
                    <input
                      type="checkbox"
                      className="check-input"
                      checked={item.checked}
                      disabled={disabled}
                      onChange={() => onChange({ items: [item.index] }, !item.checked)}
                    />
                    <span className="check-box" aria-hidden="true">
                      {item.checked && <Check className="size-3" />}
                    </span>
                    <span>{item.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
