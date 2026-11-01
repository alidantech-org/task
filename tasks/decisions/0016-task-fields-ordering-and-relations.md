---
id: DEC-0016
name: Optional task fields for ordering, hierarchy, relations and recurrence
type: decision
status: accepted
created_at: 2026-11-01
---

# Decision 0016: Optional task fields for ordering, hierarchy, relations and recurrence

- **Status:** Accepted
- **Date:** 2026-11-01
- **Scope:** Task frontmatter, task ordering, templates and recurring tasks

## Context

Tasks could not be reordered, had no hierarchy beyond groups and no relations beyond `depends_on`. Users expect drag ordering, subtasks, typed links, estimates, watchers and recurring work.

## Decisions

1. **New optional top-level task fields**, declared in the strict schema: `order` (finite number), `parent` (a task id), `estimate` (number of points, zero or more), `links` (list of `{type, task}` with type `blocks`, `relates` or `duplicates`), `watchers` (unique names), `attachments` (see Decision 0017) and `recurrence` (`{every: day|week|month, interval, until?}`). Existing files stay valid.
2. **Ordering.** A group's display order is `order` ascending. Tasks without `order` fall back to the numeric file prefix (`NNN-`) and then `created_at`. New tasks get the highest order in their group plus 1024. Reordering stores a rank between its new neighbours and renumbers the group in steps of 1024 when gaps become too small. Board columns show the group order filtered by status.
3. **Hierarchy and relations.** `parent` must reference an existing task, never itself and never form a cycle; children are derived. `links` targets must exist and are unique per type. `depends_on` is unchanged.
4. **Templates** are documents of type `task-template` under `<workspace>/templates/`. A task can be created from one.
5. **Recurrence.** Completing a recurring task creates the next occurrence with the same body and fields, status `planned`, the due date advanced by the interval and `extra.recurred_from`, unless `until` has passed.
6. **Writes stay per file** with the existing optimistic hash, so concurrent edits surface as conflicts. Bulk updates apply per task and report each result.

## Consequences

- Task files gain more frontmatter; validation and documentation must cover every field.
- The default CLI sort changes from name to order.
