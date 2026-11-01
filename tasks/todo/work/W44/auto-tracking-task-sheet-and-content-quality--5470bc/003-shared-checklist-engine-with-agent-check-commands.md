---
{id: TSK-A4B5D75F4BE0,name: Shared checklist engine with agent check commands,type: task,status: completed,priority: high,created_at: 2026-11-01T03:18:55.215Z,updated_at: 2026-11-01T03:33:51.371Z,due_at: 2026-11-01,extra: {status_history: [{from: planned,to: completed,at: 2026-11-01T03:33:51.371Z}]}}
---

# Shared checklist engine with agent check commands

## Goal
Give people and agents one reliable way to read and tick checkboxes in task files. Tasks should be a single detailed file with steps as checkboxes grouped under headings, and every surface must interpret those checkboxes identically so that progress shown in the dashboard, the command line and the validator always agrees.

## Context
Checkbox helpers used to live only in the dashboard and counted lines inside fenced code. The new engine lives in the workspace package as pure functions so the browser bundle can share it. Items are numbered in document order, grouped under the nearest heading, and selectable by number, by heading or all at once. Writes go through the safe document replace with an optimistic hash so concurrent edits are detected.

## Acceptance checklist
- [x] Parse checkboxes into groups by heading and ignore fenced code.
- [x] Check or uncheck items by index, heading or all, reporting how many lines changed.
- [x] Expose task checklist, task check and task uncheck on the command line with json output.
- [x] Expose read and update routes in the local runtime with stale hash protection.
- [x] Switch the dashboard to the shared engine for progress and toggling.
