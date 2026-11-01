---
{id: GRP-993ACE961FB9,name: Everyday task experience,type: documentation,extra: {created_at: 2026-11-01T04:27:33.100Z}}
---

# Everyday task experience plan

## Approach
Ship in six ordered slices, each committed with tests. Start with the decision records and the fixes users can see immediately: the group lookup bug, remembered view state and cleaner draggable cards. Then extend the task schema with optional fields and build the operations, command line and runtime routes for them, because the dashboard needs a stable API. Finally build the interactions on top: drag reordering with a better drag feel, day and week sheets that reuse the task sheet design, and the sheet tabs, filters, saved views and bulk actions.

## Milestones
1. Decisions 0016 and 0017 recorded and the schema documentation updated.
2. Group names, view memory and card redesign released.
3. Order, comments, subtasks, links, watchers, attachments, templates and recurrence available in the workspace package and command line.
4. Runtime routes and server tests for every new capability.
5. Drag reordering, day sheet and week sheet working in the dashboard.
6. Task sheet tabs, filters, saved views and bulk actions complete.

## Risks and open questions
The scope is large, so each slice must stand alone. Fractional ordering needs renumbering to avoid running out of precision. Attachments add a new write path that must stay small and safe. The drag library sortable interface should be checked before coding the drag work.
