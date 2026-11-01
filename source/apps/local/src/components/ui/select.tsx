"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select } from "radix-ui";

export type SelectOption = {
  value: string;
  label: string;
  color?: string;
};

export function CustomSelect({
  value,
  onValueChange,
  options,
  label,
  placeholder = "Select…",
  disabled = false,
  className = "",
}: {
  value: string;
  onValueChange(value: string): void;
  options: readonly SelectOption[];
  label: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select.Root value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <Select.Trigger className={`custom-select ${className}`} aria-label={label}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown className="size-4" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="custom-select-content" position="popper" sideOffset={4}>
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item className="custom-select-item" key={option.value} value={option.value}>
                <span className="custom-select-item-text">
                  {option.color && <i style={{ backgroundColor: option.color }} />}
                  <Select.ItemText>{option.label}</Select.ItemText>
                </span>
                <Select.ItemIndicator>
                  <Check className="size-4 text-primary" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
