"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";
import { useMemo, useState } from "react";
import { dateKey, monthGrid } from "@/lib/calendar";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function DatePicker({
  value,
  onValueChange,
  label,
}: {
  value: string;
  onValueChange(value: string): void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => (value ? new Date(`${value}T12:00:00`) : new Date()));
  const cells = useMemo(() => monthGrid(month, 1), [month]);
  const shownValue = value
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "Choose a date";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="date-picker" aria-label={label}>
          <span>{shownValue}</span>
          <CalendarDays className="size-4 text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="date-picker-content" sideOffset={5} align="start">
          <div className="date-picker-head">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
              }
            >
              <ChevronLeft className="size-4" />
            </button>
            <strong>{month.toLocaleDateString("en", { month: "long", year: "numeric" })}</strong>
            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
              }
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="date-picker-grid date-picker-weekdays">
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="date-picker-grid">
            {cells.map((date) => {
              const key = dateKey(date);
              const outside = date.getMonth() !== month.getMonth();
              return (
                <button
                  type="button"
                  key={key}
                  aria-label={date.toLocaleDateString("en", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  aria-pressed={key === value}
                  className={`${outside ? "outside" : ""} ${key === value ? "selected" : ""}`}
                  onClick={() => {
                    onValueChange(key);
                    setOpen(false);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="date-picker-footer">
            <button
              type="button"
              onClick={() => {
                onValueChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                const today = dateKey(new Date());
                onValueChange(today);
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
