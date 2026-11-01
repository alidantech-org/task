---
{id: TSK-876DF4236BB7,name: "Ungrouped fix, remembered views and cleaner task cards",type: task,status: completed,priority: high,created_at: 2026-11-01T04:27:33.254Z,updated_at: 2026-11-01T04:30:46.360Z,due_at: 2026-11-01,extra: {status_history: [{from: planned,to: completed,at: 2026-11-01T04:30:46.360Z}]}}
---

# Ungrouped fix, remembered views and cleaner task cards

## Goal
Fix the bug that makes every task appear ungrouped, make the board, list and calendar remember how the user left them after a refresh, and redesign the draggable cards so they are compact and consistent.

## Context
Group lookups used a list that hides finished and archived groups, so completed work lost its group name. View state lived only in memory. Cards showed long titles, a large group tag and the status, which the board column already shows. A hover button should open the task sheet while the card body stays draggable.

## Acceptance checklist
- [ ] Expose every group and use one shared lookup everywhere a group name is shown.
- [ ] Persist the view, filters, calendar mode and tray state in local storage with validation.
- [ ] Clamp titles to two lines, show a tiny one-line group name and place date and priority dot neatly.
- [ ] Add a hover button on board and calendar cards that opens the task sheet.
- [ ] Add tests for the lookup, the persistence helper and the card markup.

## Notes
This slice has no schema changes and is safe to ship first. Verify it against the live workspace, where every group is finished, because that case is exactly what hid the group names. Keep the card markup small so the board stays fast with many tasks.
