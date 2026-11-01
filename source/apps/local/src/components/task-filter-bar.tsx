"use client";

import { Bookmark, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useDialogs } from "@/components/dialogs";
import { CustomSelect } from "@/components/ui/select";
import {
  emptyFilters,
  isFiltering,
  type SavedView,
  type TaskFilters,
  upsertView,
} from "@/lib/task-filters";

const any = "__any";

type Option = { value: string; label: string; color?: string };

/** A custom select whose first option clears the filter and whose placeholder names it. */
function FilterSelect({
  label,
  value,
  anyLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  anyLabel: string;
  options: readonly Option[];
  onChange(value: string): void;
}) {
  return (
    <CustomSelect
      label={label}
      value={value}
      placeholder={anyLabel}
      className="fb-select"
      options={[{ value: any, label: anyLabel }, ...options]}
      onValueChange={(next) => onChange(next === any ? "" : next)}
    />
  );
}

type Props = {
  filters: TaskFilters;
  onFilters(filters: TaskFilters): void;
  views: readonly SavedView[];
  onViews(views: SavedView[]): void;
  assignees: readonly string[];
  tags: readonly string[];
  groups: readonly { id: string; name: string }[];
  groupId: string;
  onGroup(id: string): void;
  archived: boolean;
  onArchived(archived: boolean): void;
  /** How many tasks match, shown next to the controls. */
  matching: number;
};

/** Search plus group, assignee, label, priority, due, watching and archive filters, and named views. */
export function TaskFilterBar({
  filters,
  onFilters,
  views,
  onViews,
  assignees,
  tags,
  groups,
  groupId,
  onGroup,
  archived,
  onArchived,
  matching,
}: Props) {
  const { prompt } = useDialogs();
  const [selectedView, setSelectedView] = useState("");
  const set = (patch: Partial<TaskFilters>) => onFilters({ ...filters, ...patch });
  const active = isFiltering(filters) || groupId !== "" || archived;
  return (
    <search className="filter-bar" aria-label="Filter tasks">
      <input
        type="search"
        className="fb-search"
        value={filters.text}
        placeholder="Search tasks"
        aria-label="Search tasks"
        onChange={(event) => set({ text: event.target.value })}
      />
      <FilterSelect
        label="Group"
        value={groupId}
        anyLabel="All groups"
        options={groups.map((group) => ({ value: group.id, label: group.name }))}
        onChange={onGroup}
      />
      <FilterSelect
        label="Assignee"
        value={filters.assignee}
        anyLabel="Anyone"
        options={[
          { value: "me", label: "Me" },
          ...assignees.map((name) => ({ value: name, label: name })),
        ]}
        onChange={(assignee) => set({ assignee })}
      />
      <FilterSelect
        label="Label"
        value={filters.tag}
        anyLabel="Any label"
        options={tags.map((tag) => ({ value: tag, label: tag }))}
        onChange={(tag) => set({ tag })}
      />
      <FilterSelect
        label="Priority"
        value={filters.priority}
        anyLabel="Any priority"
        options={[
          { value: "high", label: "High", color: "var(--bl)" },
          { value: "medium", label: "Medium", color: "var(--ip)" },
          { value: "low", label: "Low", color: "var(--pl)" },
        ]}
        onChange={(priority) => set({ priority })}
      />
      <FilterSelect
        label="Due"
        value={filters.due}
        anyLabel="Any due date"
        options={[
          { value: "overdue", label: "Overdue" },
          { value: "week", label: "Due this week" },
          { value: "none", label: "No due date" },
        ]}
        onChange={(due) => set({ due: due as TaskFilters["due"] })}
      />
      <FilterSelect
        label="Show"
        value={archived ? "archived" : ""}
        anyLabel="Active tasks"
        options={[{ value: "archived", label: "Archived tasks" }]}
        onChange={(show) => onArchived(show === "archived")}
      />
      <label className="fb-check">
        <input
          type="checkbox"
          checked={filters.watching}
          onChange={(event) => set({ watching: event.target.checked })}
        />
        Watching
      </label>
      {active && (
        <button
          type="button"
          className="fb-clear"
          onClick={() => {
            onFilters(emptyFilters);
            onGroup("");
            onArchived(false);
          }}
        >
          <X className="size-3.5" /> Clear · {matching}
        </button>
      )}
      <span className="gap" />
      <CustomSelect
        label="Saved views"
        value={selectedView}
        placeholder="Saved views"
        className="fb-select"
        options={[
          { value: any, label: "No saved view" },
          ...views.map((view) => ({ value: view.id, label: view.name })),
        ]}
        onValueChange={(id) => {
          if (id === any) {
            setSelectedView("");
            return;
          }
          const view = views.find((item) => item.id === id);
          setSelectedView(id);
          if (view) onFilters(view.filters);
        }}
      />
      <button
        type="button"
        className="fb-icon"
        title="Save the current filters as a view"
        aria-label="Save view"
        disabled={!isFiltering(filters)}
        onClick={() => {
          void prompt({
            title: "Save this view",
            label: "Name",
            placeholder: "For example: My open bugs",
            confirmLabel: "Save view",
          }).then((name) => {
            if (!name) return;
            const next = upsertView(views, name, filters);
            onViews(next);
            setSelectedView(
              next.find((view) => view.name.toLowerCase() === name.toLowerCase())?.id ?? "",
            );
          });
        }}
      >
        <Bookmark className="size-4" />
      </button>
      <button
        type="button"
        className="fb-icon"
        title="Delete the selected view"
        aria-label="Delete saved view"
        disabled={!selectedView}
        onClick={() => {
          onViews(views.filter((view) => view.id !== selectedView));
          setSelectedView("");
        }}
      >
        <Trash2 className="size-4" />
      </button>
    </search>
  );
}
