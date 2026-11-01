"use client";

import { useState } from "react";

type Props = {
  count: number;
  total: number;
  groups: readonly { id: string; name: string }[];
  busy: boolean;
  onApply(patch: Record<string, unknown>): void;
  onSelectAll(): void;
  onClear(): void;
};

/** Changes every selected task at once; each change reports its own result. */
export function BulkBar({ count, total, groups, busy, onApply, onSelectAll, onClear }: Props) {
  const [assignee, setAssignee] = useState("");
  const apply = (patch: Record<string, unknown>) => count > 0 && !busy && onApply(patch);
  return (
    <section className="bulk-bar" aria-label="Bulk actions">
      <strong>{count} selected</strong>
      <button type="button" onClick={onSelectAll} disabled={count === total}>
        Select all {total}
      </button>
      <select
        aria-label="Set status"
        value=""
        disabled={count === 0 || busy}
        onChange={(event) => event.target.value && apply({ status: event.target.value })}
      >
        <option value="">Status…</option>
        <option value="planned">Planned</option>
        <option value="in-progress">In progress</option>
        <option value="blocked">Blocked</option>
        <option value="completed">Completed</option>
      </select>
      <select
        aria-label="Set priority"
        value=""
        disabled={count === 0 || busy}
        onChange={(event) => event.target.value && apply({ priority: event.target.value })}
      >
        <option value="">Priority…</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select
        aria-label="Move to group"
        value=""
        disabled={count === 0 || busy}
        onChange={(event) => event.target.value && apply({ group: event.target.value })}
      >
        <option value="">Move to group…</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      <form
        className="bulk-assign"
        onSubmit={(event) => {
          event.preventDefault();
          if (assignee.trim()) apply({ assignee: assignee.trim() });
        }}
      >
        <input
          value={assignee}
          onChange={(event) => setAssignee(event.target.value)}
          placeholder="Assign to…"
          aria-label="Assign to"
          disabled={count === 0 || busy}
        />
      </form>
      <button type="button" disabled={count === 0 || busy} onClick={() => apply({ archive: true })}>
        Archive
      </button>
      <button
        type="button"
        className="bulk-danger"
        disabled={count === 0 || busy}
        onClick={() => {
          if (
            window.confirm(
              `Delete ${count} task${count === 1 ? "" : "s"}? They can be restored from the trash for a while.`,
            )
          )
            apply({ delete: true });
        }}
      >
        Delete
      </button>
      <span className="gap" />
      <button type="button" onClick={onClear}>
        Done
      </button>
    </section>
  );
}
