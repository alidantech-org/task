---
{id: TSK-DCF402AC89EC,name: Automatic change tracking in private tool storage,type: task,status: completed,priority: high,created_at: 2026-11-01T03:18:55.143Z,updated_at: 2026-11-01T03:33:51.463Z,due_at: 2026-11-01,extra: {status_history: [{from: planned,to: in-progress,at: 2026-11-01T03:20:35.318Z},{from: in-progress,to: completed,at: 2026-11-01T03:33:51.463Z}],tracking: {segments: [{base_ref: refs/task/tracking/TSK-DCF402AC89EC/1793503235320-start,base_commit: 9ec4ba3d4c1fc816778f10e5881f7a7302258aa4,started_at: 2026-11-01T03:20:35.346Z,ended_at: 2026-11-01T03:33:51.464Z,end_error: "git diff failed: fatal: ambiguous argument 'refs/tracking/TSK-DCF402AC89EC/1793504031465-end': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'"}]}}}
---

# Automatic change tracking in private tool storage

## Goal
Show what every task changed without anyone remembering to enable tracking, in any project, and without writing into the project's own git repository. Entering in-progress should snapshot the working files, leaving it should snapshot again, and the difference should be visible from the dashboard and the command line.

## Context
Earlier tracking was opt-in, required a git repository and pinned snapshots under refs inside the project's repository. Decision 0014 moves snapshots into a private bare git repository per project under the tool data directory, used with the project as its work tree so gitignore files still apply. The directory is created with restrictive permissions, symlinked locations are refused, and limits on file count and size mark a snapshot as truncated.

## Acceptance checklist
- [x] Open and close tracking segments automatically on status changes, with a switch in task.yaml.
- [x] Store snapshots in the private store and never modify the project's repository.
- [x] Work in projects without git and honour gitignore files and built-in ignores.
- [x] Keep segments recorded under the old scheme readable.
- [x] Show a live diff for open segments and cached totals for closed ones.
- [x] Isolate tests from the real data directory.
