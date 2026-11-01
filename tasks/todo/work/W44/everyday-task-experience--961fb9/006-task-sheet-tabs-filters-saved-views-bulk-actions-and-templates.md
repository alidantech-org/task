---
{id: TSK-401ABE12933F,name: "Task sheet tabs, filters, saved views, bulk actions and templates",type: task,status: planned,priority: high,created_at: 2026-11-01T04:27:38.200Z,updated_at: 2026-11-01T04:27:38.200Z,due_at: 2026-11-01}
---

# Task sheet tabs, filters, saved views, bulk actions and templates

## Goal
Complete the task management experience in the dashboard with editable properties, comments, subtasks, activity, files, filters, saved views, bulk selection and templates.

## Context
The sheet already has overview, details, changes, edit, docs and quality tabs. It needs more tabs for subtasks, comments, activity and files plus a properties editor. The board and list need a filter bar, named views stored per browser, and a selection mode with a bulk action bar. Templates and recurrence need simple controls.

## Acceptance checklist
- [ ] Add the properties editor and the subtasks, comments, activity and files tabs.
- [ ] Add the filter bar and saved views with persistence.
- [ ] Add selection mode and the bulk action bar with per-task results.
- [ ] Add template and recurrence controls and test the helpers.

## Notes
The tab bar must keep fitting at narrow widths, so group related content and keep icons ready. Store saved views only in the browser, never in the workspace. Show per-task results for bulk changes so a partial failure never looks like a complete success.
