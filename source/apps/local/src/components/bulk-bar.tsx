"use client";

import { useState } from "react";
import { useDialogs } from "@/components/dialogs";
import { CustomSelect } from "@/components/ui/select";

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
  const { confirm } = useDialogs();
  const [assignee, setAssignee] = useState("");
  const idle = count === 0 || busy;
  const apply = (patch: Record<string, unknown>) => count > 0 && !busy && onApply(patch);
  return (
    <section className="bulk-bar" aria-label="Bulk actions">
      <strong>{count} selected</strong>
      <button type="button" onClick={onSelectAll} disabled={count === total}>
        Select all {total}
      </button>
      <CustomSelect
        label="Set status"
        value=""
        placeholder="Status…"
        disabled={idle}
        className="bulk-select"
        onValueChange={(status) => apply({ status })}
        options={[
          { value: "planned", label: "Planned", color: "var(--pl)" },
          { value: "in-progress", label: "In progress", color: "var(--ip)" },
          { value: "blocked", label: "Blocked", color: "var(--bl)" },
          { value: "completed", label: "Completed", color: "var(--dn)" },
        ]}
      />
      <CustomSelect
        label="Set priority"
        value=""
        placeholder="Priority…"
        disabled={idle}
        className="bulk-select"
        onValueChange={(priority) => apply({ priority })}
        options={[
          { value: "high", label: "High", color: "var(--bl)" },
          { value: "medium", label: "Medium", color: "var(--ip)" },
          { value: "low", label: "Low", color: "var(--pl)" },
        ]}
      />
      <CustomSelect
        label="Move to group"
        value=""
        placeholder="Move to group…"
        disabled={idle}
        className="bulk-select"
        onValueChange={(group) => apply({ group })}
        options={groups.map((group) => ({ value: group.id, label: group.name }))}
      />
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
          disabled={idle}
        />
      </form>
      <button type="button" disabled={idle} onClick={() => apply({ archive: true })}>
        Archive
      </button>
      <button
        type="button"
        className="bulk-danger"
        disabled={idle}
        onClick={() => {
          void confirm({
            title: `Delete ${count} task${count === 1 ? "" : "s"}?`,
            message: "They can be restored from the trash for a while.",
            confirmLabel: "Delete",
            danger: true,
          }).then((ok) => ok && apply({ delete: true }));
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
