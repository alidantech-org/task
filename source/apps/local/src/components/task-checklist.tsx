"use client";

import { type ChecklistSelector, parseChecklist } from "@task/workspace/documents/checklist";
import { Check, Minus } from "lucide-react";
import { useEffect, useRef } from "react";

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

function GroupToggle({
  done,
  total,
  disabled,
  label,
  onToggle,
}: {
  done: number;
  total: number;
  disabled: boolean;
  label: string;
  onToggle(checked: boolean): void;
}) {
  const reference = useRef<HTMLInputElement>(null);
  const all = done === total;
  const some = done > 0 && !all;
  useEffect(() => {
    if (reference.current) reference.current.indeterminate = some;
  }, [some]);
  return (
    <label
      className="check-group-toggle"
      title={all ? "Uncheck all in this section" : "Check all in this section"}
    >
      <input
        ref={reference}
        type="checkbox"
        className="check-input"
        checked={all}
        disabled={disabled}
        aria-label={`Check or uncheck every step in ${label}`}
        onChange={() => onToggle(!all)}
      />
      <span className={`check-box ${all ? "all" : some ? "some" : ""}`} aria-hidden="true">
        {all ? <Check className="size-3" /> : some ? <Minus className="size-3" /> : null}
      </span>
    </label>
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
      {checklist.groups.map((group) => {
        const done = group.items.filter((item) => item.checked).length;
        const indexes = group.items.map((item) => item.index);
        return (
          <section key={`${group.line}:${group.heading}`} className="check-group">
            <header>
              <GroupToggle
                done={done}
                total={group.items.length}
                disabled={disabled}
                label={group.heading || "General"}
                onToggle={(checked) => onChange({ items: indexes }, checked)}
              />
              <h3>{group.heading || "General"}</h3>
              <span className="sub">
                {done}/{group.items.length}
              </span>
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
