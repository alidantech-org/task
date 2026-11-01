---
{id: TSK-C1842E2A2455,name: "Runtime routes for ordering, comments, files and bulk changes",type: task,status: completed,priority: high,created_at: 2026-11-01T04:27:33.409Z,updated_at: 2026-11-01T04:44:33.269Z,due_at: 2026-11-01,extra: {status_history: [{from: planned,to: completed,at: 2026-11-01T04:44:33.269Z}]}}
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
