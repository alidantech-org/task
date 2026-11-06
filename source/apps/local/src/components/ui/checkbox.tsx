"use client";

import { Check, Minus } from "lucide-react";
import { Checkbox } from "radix-ui";

/** A rounded checkbox that can also show a partial state. */
export function CheckBox({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean | "indeterminate";
  onCheckedChange(checked: boolean): void;
  label: string;
}) {
  return (
    <Checkbox.Root
      className="cbx"
      checked={checked}
      aria-label={label}
      onCheckedChange={(next) => onCheckedChange(next === true)}
      onClick={(event) => event.stopPropagation()}
    >
      <Checkbox.Indicator className="cbx-mark">
        {checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}
