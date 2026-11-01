---
{id: TSK-A6E5B27385E1,name: "Decisions and docs for task fields, comments and attachments",type: task,status: completed,priority: high,created_at: 2026-11-01T04:27:33.177Z,updated_at: 2026-11-01T06:07:32.857Z,due_at: 2026-11-01,extra: {status_history: [{from: planned,to: in-progress,at: 2026-11-01T04:27:50.252Z},{from: in-progress,to: completed,at: 2026-11-01T04:30:46.209Z}],tracking: {segments: [{base_ref: refs/tracking/TSK-A6E5B27385E1/1793507270255-start,started_at: 2026-11-01T04:27:50.324Z,end_ref: refs/tracking/TSK-A6E5B27385E1/1793507446219-end,ended_at: 2026-11-01T04:30:46.209Z,summary: {files: 16,insertions: 499,deletions: 111}}]}}}
---

# Decisions and docs for task fields, comments and attachments

## Goal
Record the design choices for the new task fields, the comments format and the attachment policy before any code depends on them, so later work and agents have one reference. The decisions must explain what is stored in task files and why.

## Context
The schema is strict, so every new top-level field must be declared. Comments will live inside the task Markdown, attachments must stay small and safe, and ordering must stay stable when fields are missing. Decisions 0016 and 0017 capture these points and the architecture and agent guides must repeat them.

## Acceptance checklist
- [ ] Write decision 0016 describing order, parent, estimate, links, watchers, attachments and recurrence.
- [ ] Write decision 0017 describing comments, author identity, mentions and the attachment size policy.
- [ ] Update the metadata schema documentation and the agent guides with the new commands.
- [ ] Run task validate and confirm the workspace stays valid.

## Notes
Keep the decisions short and link them from the architecture documentation. This slice changes no behavior; it only records intent so reviewers can compare the later work against it, and so agents reading the workspace guide find the same rules the code enforces.
