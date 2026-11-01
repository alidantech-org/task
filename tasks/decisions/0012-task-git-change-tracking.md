---
id: DEC-0012
name: Task git change tracking and project file viewing
type: decision
status: accepted
created_at: 2026-11-01
---

# Decision 0012: Task git change tracking and project file viewing

- **Status:** Accepted
- **Date:** 2026-11-01
- **Scope:** Git integration for tasks, runtime file reads outside the Markdown workspace
- **Superseded in part by:** [Decision 0014](0014-private-tracking-store.md) (snapshot storage)
- **Refines:** Decision 0007 (Git stays optional and must not interfere with user-managed history)

## Context

Decision 0007 left Git integration beyond "working safely inside an existing repository" open. Users and agents need to see what changed in a project while a task was in progress, and the dashboard needs to display linked source files and diffs.

## Decisions

1. **Tracking is opt-in per task.** Starting a task with tracking records a baseline snapshot of the working tree; leaving `in-progress` records an end snapshot. Without Git, tracking reports "unavailable" and nothing else changes.
2. **Snapshots use a temporary index.** Task builds a tree with a temporary `GIT_INDEX_FILE` (`read-tree HEAD`, `add -A`, `write-tree`). The real index, branches, config, hooks and working tree are never modified, and Task never commits to a user branch.
3. **Snapshots are pinned under `refs/task/**`.** Each tree is wrapped in a commit and referenced from `refs/task/tracking/<task-id>/<n>` so `git gc` cannot prune it. This is the only repository state Task writes. Refs are kept when a task is deleted so that it can be restored from the trash with its history; pruning refs of tasks that no longer exist is unresolved.
4. **The Task workspace `todo/` folder is excluded** from snapshots. Other workspace folders and all other project files are included.
5. **Tracking is a time window, not attribution.** Concurrent tasks and human edits appear in every overlapping window. Documentation and UI must say so.
6. **The runtime may read text files under the project root, read-only.** Requests need the existing capability and origin checks, symlink-aware containment, a size cap, binary detection, and a deny-list (`.git`, `node_modules`, `.env*`, private keys and similar). The deny-list also applies to diff content.
7. **Git is spawned with argument arrays, never a shell**, with a fixed working directory, timeouts and output caps.

## Consequences

- Task now writes git objects and refs; this is recorded here rather than treated as read-only.
- New endpoints expand the runtime's read surface and need tests for traversal, symlink escape and the deny-list.
- Unresolved: pruning `refs/task/**` for tasks that were permanently removed; monorepos whose Task workspace is outside the Git root and shallow or empty repositories return "tracking unavailable" until a decision says otherwise.
