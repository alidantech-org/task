---
{id: TSK-2E34D38F08D1,name: "Schema, operations and command line for the new task features",type: task,status: planned,priority: high,created_at: 2026-11-01T04:27:33.331Z,updated_at: 2026-11-01T04:27:33.331Z,due_at: 2026-11-01}
---

# Schema, operations and command line for the new task features

## Goal
Add the optional task fields and the operations that agents and the dashboard need: manual order, comments, subtasks and relations, watchers, estimates, small attachments, templates and recurring tasks, all with command line support.

## Context
Every change goes through the shared workspace package so the command line, runtime and dashboard agree. Fields are optional and validated strictly. Writes use the existing safe replace with an optimistic hash. Ordering uses fractional ranks with renumbering, comments are stored in the task body, and attachments are limited in size and path.

## Acceptance checklist
- [ ] Add and validate order, parent, estimate, links, watchers, attachments and recurrence.
- [ ] Implement reorder, comments, move to group, attachments, templates, recurrence and bulk update.
- [ ] Expose each capability through the command line with json output.
- [ ] Cover validation, safety limits and edge cases with tests.

## Notes
Every new field is optional so existing task files stay valid. Keep validation strict and errors specific, because agents read the messages. Prefer small pure helpers for ranking, mentions and recurrence so they are easy to test without touching the filesystem.
