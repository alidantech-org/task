---
id: DEC-0014
name: Automatic change tracking in a private tool store
type: decision
status: accepted
created_at: 2026-11-01
---

# Decision 0014: Automatic change tracking in a private tool store

- **Status:** Accepted
- **Date:** 2026-11-01
- **Scope:** Where and when task change snapshots are recorded
- **Supersedes:** The `refs/task/**` storage part of [Decision 0012](0012-task-git-change-tracking.md)

## Context

Opt-in tracking required agents to remember a flag, only worked inside git repositories, and wrote objects and refs into the project's `.git`. Users want every task's changes visible without setup, in projects with or without Git, and want the tool to keep its data outside the project.

## Decisions

1. **Tracking is automatic.** Entering `in-progress` opens a snapshot window; leaving it closes the window with an end snapshot and a cached summary. `tracking.enabled: false` in `task.yaml` turns it off. The `--track` flag remains accepted and has no effect.
2. **Snapshots live in a private bare git repository per project** at `<data dir>/projects/<hash of real project root>/store.git`, used with `GIT_DIR` set to that store and `GIT_WORK_TREE` set to the project. The project's own `.git`, index, branches and config are never written. The same code serves git and non-git projects; it needs the `git` executable and otherwise reports tracking as unavailable.
3. **Data directory:** `TASK_DATA_DIR`, else `XDG_DATA_HOME/taskcode` or `~/.local/share/taskcode` on Linux, `~/Library/Application Support/taskcode` on macOS, `%LOCALAPPDATA%\taskcode` on Windows.
4. **Safe storage:** directories are created with mode 0700 and files 0600; no symlinked components are accepted in the data directory path; a lock file serialises snapshot and ref updates; limits on file count, file size and total size mark a snapshot as truncated; system git config and hooks are not used.
5. **What is captured:** the working tree honouring `.gitignore` files in the project, built-in ignores (`node_modules`, `.git`, build output) and the protected-path list, excluding the workspace `todo/` folder.
6. **Compatibility:** segments created under Decision 0012 (`refs/task/**` in the project repository) stay readable.
7. Tracking remains a time window, not authorship.

## Consequences

- Snapshots disappear if the data directory is removed; totals cached in the task's frontmatter remain.
- The private store grows over time; pruning is unresolved and should be a later command.
