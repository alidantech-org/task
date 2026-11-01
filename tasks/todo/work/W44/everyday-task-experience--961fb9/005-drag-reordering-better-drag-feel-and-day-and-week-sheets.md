---
{id: TSK-7DD5FE414257,name: "Drag reordering, better drag feel and day and week sheets",type: task,status: planned,priority: high,created_at: 2026-11-01T04:27:33.487Z,updated_at: 2026-11-01T04:27:33.487Z,due_at: 2026-11-01}
---

# Drag reordering, better drag feel and day and week sheets

## Goal
Make dragging feel good and persistent, and let users manage a whole day or week from the calendar in a sheet that matches the task sheet.

## Context
Cards currently use default drag behavior with no overlay or drop indicator and cannot be reordered. The calendar shows a dead overflow label and clicking a day does nothing. A shared sheet shell will be extracted from the task sheet so the day and week sheets reuse its look, resizing and header layout.

## Acceptance checklist
- [ ] Add sensors, a drag overlay, a placeholder, a drop indicator and a settle animation.
- [ ] Reorder within and between columns and persist the order.
- [ ] Extract a shared sheet shell from the task sheet.
- [ ] Build the day sheet and the week sheet with quick add and totals.
- [ ] Test the ranking helper and the sheet content.

## Notes
Check the installed drag library version for its sortable helpers before writing code. Keep clicks working by requiring a small movement before a drag starts. Respect reduced motion preferences and keep every drag action available from the keyboard as well.
