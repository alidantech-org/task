"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { RecordItem } from "@/components/layout/app-layout";
import { DatePicker } from "@/components/ui/date-picker";
import { CustomSelect } from "@/components/ui/select";

type Link = { type: "blocks" | "relates" | "duplicates"; task: string };
type Recurrence = { every: "day" | "week" | "month"; interval: number; until?: string };
type GroupOption = { id: string; name: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="prop">
      <span className="fld">{label}</span>
      {children}
    </div>
  );
}

function TagInput({
  label,
  values,
  placeholder,
  onChange,
}: {
  label: string;
  values: readonly string[];
  placeholder: string;
  onChange(values: string[]): void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const name = draft.trim().replace(/,$/, "");
    setDraft("");
    if (name && !values.includes(name)) onChange([...values, name]);
  };
  return (
    <div className="chips-input">
      {values.map((value) => (
        <span key={value} className="chip-token">
          {value}
          <button
            type="button"
            aria-label={`Remove ${value}`}
            onClick={() => onChange(values.filter((item) => item !== value))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        aria-label={label}
        placeholder={values.length ? "" : placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add();
          }
          if (event.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
      />
    </div>
  );
}

/** Editable task properties; every change is saved straight away through `onSave`. */
export function TaskProperties({
  task,
  candidates,
  groups,
  assignees,
  currentGroupId,
  onSave,
}: {
  task: RecordItem;
  /** Other tasks that can be a parent or the target of a link. */
  candidates: readonly RecordItem[];
  groups: readonly GroupOption[];
  assignees: readonly string[];
  currentGroupId: string | undefined;
  onSave(patch: Record<string, unknown>): Promise<boolean>;
}) {
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [estimate, setEstimate] = useState(
    task.estimate === undefined ? "" : String(task.estimate),
  );
  const [linkType, setLinkType] = useState<Link["type"]>("relates");
  const [linkTarget, setLinkTarget] = useState("");
  const links = (task.links ?? []) as Link[];
  const recurrence = task.recurrence as Recurrence | undefined;
  useEffect(() => {
    setAssignee(task.assignee ?? "");
    setEstimate(task.estimate === undefined ? "" : String(task.estimate));
  }, [task.assignee, task.estimate]);
  const taskOptions = candidates
    .slice(0, 300)
    .map((item) => ({ value: item.id, label: item.name }));
  return (
    <div className="task-props">
      <Field label="Assignee">
        <input
          list="task-assignees"
          value={assignee}
          placeholder="Nobody"
          aria-label="Assignee"
          onChange={(event) => setAssignee(event.target.value)}
          onBlur={() =>
            assignee !== (task.assignee ?? "") && void onSave({ assignee: assignee.trim() })
          }
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
        <datalist id="task-assignees">
          {assignees.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </Field>
      <Field label="Estimate (points)">
        <input
          type="number"
          min={0}
          step={0.5}
          value={estimate}
          placeholder="—"
          aria-label="Estimate"
          onChange={(event) => setEstimate(event.target.value)}
          onBlur={() => {
            const next = estimate.trim() === "" ? null : Number(estimate);
            if (next !== (task.estimate ?? null) && (next === null || Number.isFinite(next)))
              void onSave({ estimate: next });
          }}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
      </Field>
      <Field label="Start date">
        <DatePicker
          label="Start date"
          value={task.start_at ?? ""}
          onValueChange={(date) => void onSave({ startAt: date || null })}
        />
      </Field>
      <Field label="Group">
        <CustomSelect
          label="Group"
          value={currentGroupId ?? ""}
          placeholder="Ungrouped"
          options={groups.map((group) => ({ value: group.id, label: group.name }))}
          onValueChange={(group) => group !== currentGroupId && void onSave({ group })}
        />
      </Field>
      <Field label="Parent task">
        <CustomSelect
          label="Parent task"
          value={task.parent ?? "none"}
          options={[{ value: "none", label: "No parent" }, ...taskOptions]}
          onValueChange={(parent) => void onSave({ parent: parent === "none" ? null : parent })}
        />
      </Field>
      <Field label="Repeat">
        <div className="prop-row">
          <CustomSelect
            label="Repeat"
            value={recurrence?.every ?? "none"}
            options={[
              { value: "none", label: "Does not repeat" },
              { value: "day", label: "Daily" },
              { value: "week", label: "Weekly" },
              { value: "month", label: "Monthly" },
            ]}
            onValueChange={(every) =>
              void onSave({
                recurrence:
                  every === "none" ? null : { every, interval: recurrence?.interval ?? 1 },
              })
            }
          />
          {recurrence && (
            <input
              type="number"
              min={1}
              className="prop-interval"
              aria-label="Repeat every"
              defaultValue={recurrence.interval}
              onBlur={(event) => {
                const interval = Math.max(1, Math.floor(Number(event.target.value) || 1));
                if (interval !== recurrence.interval)
                  void onSave({ recurrence: { ...recurrence, interval } });
              }}
            />
          )}
        </div>
      </Field>
      <Field label="Labels">
        <TagInput
          label="Labels"
          values={task.tags}
          placeholder="Add a label"
          onChange={(tags) => void onSave({ tags })}
        />
      </Field>
      <Field label="Watchers">
        <TagInput
          label="Watchers"
          values={task.watchers ?? []}
          placeholder="Add a name"
          onChange={(watchers) => void onSave({ watchers })}
        />
      </Field>
      <div className="prop prop-wide">
        <span className="fld">Linked tasks</span>
        <ul className="prop-links">
          {links.map((link) => (
            <li key={`${link.type}:${link.task}`}>
              <b>{link.type}</b>
              <span>{candidates.find((item) => item.id === link.task)?.name ?? link.task}</span>
              <button
                type="button"
                aria-label="Remove link"
                onClick={() => void onSave({ links: links.filter((item) => item !== link) })}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        <div className="prop-row">
          <CustomSelect
            label="Link type"
            value={linkType}
            options={[
              { value: "relates", label: "Relates to" },
              { value: "blocks", label: "Blocks" },
              { value: "duplicates", label: "Duplicates" },
            ]}
            onValueChange={(value) => setLinkType(value as Link["type"])}
          />
          <CustomSelect
            label="Linked task"
            value={linkTarget}
            placeholder="Choose a task"
            options={taskOptions}
            onValueChange={setLinkTarget}
          />
          <button
            type="button"
            className="prop-add"
            disabled={!linkTarget}
            onClick={() => {
              void onSave({ links: [...links, { type: linkType, task: linkTarget }] }).then(
                (ok) => ok && setLinkTarget(""),
              );
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
