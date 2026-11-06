---
{id: TSK-C1842E2A2455,name: "Runtime routes for ordering, comments, files and bulk changes",type: task,status: completed,priority: high,created_at: 2026-11-01T04:27:33.409Z,updated_at: 2026-11-03T05:39:53.438Z,due_at: 2026-11-01,extra: {status_history: [{from: planned,to: completed,at: 2026-11-01T04:44:33.269Z},{from: completed,to: in-progress,at: 2026-11-03T05:33:36.456Z},{from: in-progress,to: completed,at: 2026-11-03T05:33:41.227Z},{from: completed,to: blocked,at: 2026-11-03T05:34:11.556Z},{from: blocked,to: completed,at: 2026-11-03T05:36:20.274Z},{from: completed,to: planned,at: 2026-11-03T05:39:33.577Z},{from: planned,to: completed,at: 2026-11-03T05:39:53.126Z}],tracking: {segments: [{base_ref: refs/tracking/TSK-C1842E2A2455/1793684016457-start,started_at: 2026-11-03T05:33:36.499Z,end_ref: refs/tracking/TSK-C1842E2A2455/1793684021228-end,ended_at: 2026-11-03T05:33:41.227Z,summary: {files: 0,insertions: 0,deletions: 0}}]}},order: 6032,archived_at: 2026-11-06T08:46:59.461Z}
---

# Runtime routes for ordering, comments, files and bulk changes

## Goal
Expose the new capabilities through the local runtime so the dashboard can use them, keeping every route behind the existing capability and origin checks.

## Context
Routes must be registered before the broad task prefixes or they are swallowed by earlier handlers. Uploads arrive as small base64 json bodies with a hard size cap and downloads are sent as attachments with no sniffing. The snapshot also needs the new fields and cached checklist progress so cards stay cheap.

## Acceptance checklist
- [ ] Extend the task patch route with the new fields.
- [ ] Add reorder, comments, attachments, templates, bulk and activity routes.
- [ ] Return checklist progress and comment counts in the snapshot.
- [ ] Add server tests for authorization, conflicts, validation and limits.

## Notes
Remember that the runtime matches path prefixes in order, so new routes belong before the broad task handlers. Keep request bodies small, reject unknown keys, and return the refreshed workspace snapshot with each change so the dashboard stays consistent without extra fetches.
