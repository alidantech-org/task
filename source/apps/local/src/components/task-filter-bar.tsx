"use client";

import { Bookmark, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  emptyFilters,
  isFiltering,
  type SavedView,
  type TaskFilters,
  upsertView,
} from "@/lib/task-filters";

type Props = {
  filters: TaskFilters;
  onFilters(filters: TaskFilters): void;
  views: readonly SavedView[];
  onViews(views: SavedView[]): void;
  assignees: readonly string[];
  tags: readonly string[];
  /** How many tasks match, shown next to the controls. */
  matching: number;
};

/** Search, assignee, label, priority, due and watching filters, plus named views kept in this browser. */
export function TaskFilterBar({
  filters,
  onFilters,
  views,
  onViews,
  assignees,
  tags,
  matching,
}: Props) {
  const [selectedView, setSelectedView] = useState("");
  const set = (patch: Partial<TaskFilters>) => onFilters({ ...filters, ...patch });
  const active = isFiltering(filters);
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
      <select
        aria-label="Assignee"
        value={filters.assignee}
        onChange={(event) => set({ assignee: event.target.value })}
      >
        <option value="">Anyone</option>
        <option value="me">Me</option>
        {assignees.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Label"
        value={filters.tag}
        onChange={(event) => set({ tag: event.target.value })}
      >
        <option value="">Any label</option>
        {tags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
      <select
        aria-label="Priority"
        value={filters.priority}
        onChange={(event) => set({ priority: event.target.value })}
      >
        <option value="">Any priority</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select
        aria-label="Due"
        value={filters.due}
        onChange={(event) => set({ due: event.target.value as TaskFilters["due"] })}
      >
        <option value="">Any due date</option>
        <option value="overdue">Overdue</option>
        <option value="week">Due this week</option>
        <option value="none">No due date</option>
      </select>
      <label className="fb-check">
        <input
          type="checkbox"
          checked={filters.watching}
          onChange={(event) => set({ watching: event.target.checked })}
        />
        Watching
      </label>
      {active && (
        <button type="button" className="fb-clear" onClick={() => onFilters(emptyFilters)}>
          <X className="size-3.5" /> Clear · {matching}
        </button>
      )}
      <span className="gap" />
      <select
        aria-label="Saved views"
        value={selectedView}
        onChange={(event) => {
          const view = views.find((item) => item.id === event.target.value);
          setSelectedView(event.target.value);
          if (view) onFilters(view.filters);
        }}
      >
        <option value="">Saved views</option>
        {views.map((view) => (
          <option key={view.id} value={view.id}>
            {view.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="fb-icon"
        title="Save the current filters as a view"
        aria-label="Save view"
        disabled={!active}
        onClick={() => {
          const name = window.prompt("Name this view");
          if (!name?.trim()) return;
          const next = upsertView(views, name, filters);
          onViews(next);
          setSelectedView(
            next.find((view) => view.name.toLowerCase() === name.trim().toLowerCase())?.id ?? "",
          );
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
