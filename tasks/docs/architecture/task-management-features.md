---
id: DOC-ARCHITECTURE-TASK-MANAGEMENT-FEATURES
name: Task management features
type: documentation
tags:
  - engineering
  - architecture
---

# Task management features

How the everyday task experience is built. Field definitions are in [markdown-metadata-schema.md](markdown-metadata-schema.md); the decisions are 0016 and 0017.

## Ordering and dragging

Board columns and list rows are sorted by group, then by each task's `order` (`lib/board-order.ts`, which mirrors `operations/order.ts`). Board cards are sortable items (`@dnd-kit/react/sortable`) grouped by status. Dropping a card calls the runtime with its new status and a neighbour from the same group (`POST /workspace/task/:id/reorder` with `before` or `after`); the workspace gives it a rank between its neighbours and renumbers the group in steps of 1024 when there is no room. A lifted preview follows the pointer, the original becomes a dashed placeholder and the target column is highlighted. Keyboard dragging works with Space and the arrow keys.

## Calendar sheets

Clicking a day number or "+N more" opens the day sheet; the toolbar button opens the week sheet. Both use the shared `SheetShell` (blur, resize by dragging the left edge, expand, hide when dragged narrower than the minimum) and show totals, per-task status and reschedule controls, and quick add.

## Task sheet

Tabs: Overview (description, tasks, analytics and a Properties editor), Details, Subtasks (children and rollup), Comments (authors, `@mentions`, delete), Activity (merged timeline), Changes, Edit, Docs, Files (attachments up to 1 MB and links) and Quality. Counters on tabs are neutral numbers (steps left, comments, subtasks, files, files changed); only the Quality count is a red alert.

## Filters, saved views and bulk changes

The filter bar searches text and filters by assignee (including "Me", from the configured author), label, priority, due state and watching. Filters persist across refreshes and can be saved as named views in this browser (`localStorage`, never in the workspace). Selection mode adds checkboxes to cards and rows and a bulk bar (status, priority, group, assignee, archive, delete); the runtime applies each change per task and reports each outcome (`POST /workspace/tasks/bulk`).

## Templates and recurring tasks

`task template create` stores a reusable body and default fields; `task create --template` and the new-task dialog use them. A task with `recurrence` creates its next occurrence when completed, with a fresh checklist, no comments and the due date advanced by the interval, unless `until` has passed.

## Not built

Server storage for files over 1 MB, notifications for mentions and watchers, and drag-to-reorder inside the day and week sheets.
