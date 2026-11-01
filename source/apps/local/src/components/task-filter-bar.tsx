"use client";

import { Bookmark, CheckSquare, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Switch } from "radix-ui";
import { useState } from "react";
import { useDialogs } from "@/components/dialogs";
import { SheetShell } from "@/components/sheet-shell";
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

const priorityOptions: Option[] = [
  { value: "high", label: "High", color: "var(--bl)" },
  { value: "medium", label: "Medium", color: "var(--ip)" },
  { value: "low", label: "Low", color: "var(--pl)" },
];

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
  /** Whether multi-select mode is on. */
  selecting: boolean;
  onSelecting(selecting: boolean): void;
  /** How many tasks match, shown next to the controls. */
  matching: number;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fs-field">
      <span className="fs-label">{label}</span>
      {children}
    </div>
  );
}

/**
 * Search plus the two filters used most, group and priority. Everything else (assignee, label, due
 * date, archive, watching, saved views and selection mode) lives in the filters sheet.
 */
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
  selecting,
  onSelecting,
  matching,
}: Props) {
  const { prompt } = useDialogs();
  const [sheet, setSheet] = useState(false);
  const [selectedView, setSelectedView] = useState("");
  const set = (patch: Partial<TaskFilters>) => onFilters({ ...filters, ...patch });
  const advanced = [
    filters.assignee,
    filters.tag,
    filters.due,
    filters.watching ? "watching" : "",
    archived ? "archived" : "",
  ].filter(Boolean).length;
  const active = isFiltering(filters) || groupId !== "" || archived;
  const clear = () => {
    onFilters(emptyFilters);
    onGroup("");
    onArchived(false);
    setSelectedView("");
  };
  return (
    <>
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
          label="Priority"
          value={filters.priority}
          anyLabel="Any priority"
          options={priorityOptions}
          onChange={(priority) => set({ priority })}
        />
        <button
          type="button"
          className={`fb-more ${advanced > 0 || selecting ? "on" : ""}`}
          onClick={() => setSheet(true)}
        >
          <SlidersHorizontal className="size-4" /> Filters
          {advanced > 0 ? <b>{advanced}</b> : null}
        </button>
        {active && (
          <button type="button" className="fb-clear" onClick={clear}>
            <X className="size-3.5" /> Clear · {matching}
          </button>
        )}
      </search>
      {sheet && (
        <SheetShell
          title="Filters and views"
          meta={`${matching} matching task${matching === 1 ? "" : "s"}`}
          storageKey="filter-sheet-width"
          onClose={() => setSheet(false)}
          actions={
            active ? (
              <button type="button" className="fb-clear" onClick={clear}>
                Clear all
              </button>
            ) : null
          }
        >
          <div className="fs">
            <section>
              <h3>More filters</h3>
              <Field label="Assignee">
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
              </Field>
              <Field label="Label">
                <FilterSelect
                  label="Label"
                  value={filters.tag}
                  anyLabel="Any label"
                  options={tags.map((tag) => ({ value: tag, label: tag }))}
                  onChange={(tag) => set({ tag })}
                />
              </Field>
              <Field label="Due date">
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
              </Field>
              <Field label="Show">
                <FilterSelect
                  label="Show"
                  value={archived ? "archived" : ""}
                  anyLabel="Active tasks"
                  options={[{ value: "archived", label: "Archived tasks" }]}
                  onChange={(show) => onArchived(show === "archived")}
                />
              </Field>
              <div className="fs-switch">
                <span>
                  Watching
                  <small>Only tasks you watch</small>
                </span>
                <Switch.Root
                  className="switch"
                  checked={filters.watching}
                  onCheckedChange={(watching) => set({ watching })}
                >
                  <Switch.Thumb className="switch-thumb" />
                </Switch.Root>
              </div>
            </section>
            <section>
              <h3>Select tasks</h3>
              <div className="fs-switch">
                <span>
                  Selection mode
                  <small>Pick several tasks to change them together</small>
                </span>
                <Switch.Root
                  className="switch"
                  checked={selecting}
                  onCheckedChange={(next) => {
                    onSelecting(next);
                    if (next) setSheet(false);
                  }}
                >
                  <Switch.Thumb className="switch-thumb" />
                </Switch.Root>
              </div>
            </section>
            <section>
              <h3>Saved views</h3>
              <button
                type="button"
                className="fs-save"
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
                <Bookmark className="size-4" /> Save current filters as a view
              </button>
              {views.length === 0 ? (
                <p className="sub">No saved views yet. Set some filters, then save them here.</p>
              ) : (
                <ul className="fs-views">
                  {views.map((view) => (
                    <li key={view.id} className={selectedView === view.id ? "on" : ""}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedView(view.id);
                          onFilters(view.filters);
                        }}
                      >
                        <CheckSquare className="size-4" /> {view.name}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${view.name}`}
                        onClick={() => {
                          onViews(views.filter((item) => item.id !== view.id));
                          if (selectedView === view.id) setSelectedView("");
                        }}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </SheetShell>
      )}
    </>
  );
}
