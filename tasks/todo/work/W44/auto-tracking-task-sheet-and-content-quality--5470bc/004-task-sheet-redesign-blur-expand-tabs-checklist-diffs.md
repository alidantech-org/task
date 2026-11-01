---
{id: TSK-A8454550E891,name: "Task sheet redesign: blur, expand, tabs, checklist, diffs",type: task,status: completed,priority: high,created_at: 2026-11-01T03:18:55.287Z,updated_at: 2026-11-01T03:35:28.999Z,due_at: 2026-11-01,extra: {status_history: [{from: planned,to: in-progress,at: 2026-11-01T03:34:07.955Z},{from: in-progress,to: completed,at: 2026-11-01T03:35:28.999Z}],tracking: {segments: [{base_ref: refs/tracking/TSK-A8454550E891/1793504047957-start,started_at: 2026-11-01T03:34:07.981Z,end_ref: refs/tracking/TSK-A8454550E891/1793504129001-end,ended_at: 2026-11-01T03:35:28.999Z,summary: {files: 7,insertions: 76,deletions: 35}}]}}}
---

# Task sheet redesign: blur, expand, tabs, checklist, diffs

## Goal
Replace the narrow task drawer with a sheet that is pleasant and useful for real work. It should sit over a blurred backdrop, expand to a wide layout, always be closable, and offer more than reading Markdown: structured checklists, diffs of what the task changed, editing, related documents and a view of the quality findings.

## Context
The old drawer was fixed at about 460 pixels, had no backdrop, no focus handling and only showed changes for tasks that had been explicitly tracked. Tracking is now automatic, the checklist engine is shared, and the quality policy can be evaluated in the browser, so the sheet can present all of them. It is built on the Radix dialog so focus, escape and outside clicks behave correctly.

## Acceptance checklist
- [x] Blurred, dimmed backdrop with the sheet sliding in and an expand toggle remembered between visits.
- [x] Close with the button, the escape key or a click on the backdrop, with a guard against discarding unsaved edits.
- [x] Overview, Checklist, Changes, Edit, Docs and Quality tabs.
- [x] Checklist tab groups checkboxes by heading with progress and check all controls.
- [x] Changes tab shows file totals and expandable diffs with highlighting.
- [x] Actions menu keeps archive, restore, hide and delete.
