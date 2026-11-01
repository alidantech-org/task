---
id: DOC-ARCHITECTURE-DELETE-TRACKING-VIEWING
name: Delete, git change tracking and file viewing
type: documentation
tags:
  - engineering
  - architecture
---

# Delete, git change tracking and file viewing

Accepted in [Decision 0012](../../decisions/0012-task-git-change-tracking.md) and [Decision 0013](../../decisions/0013-recoverable-delete.md). All behavior lives in `@task/workspace`; the CLI, local runtime, dashboard and TUI call the same operations.

## Self-documentation (`task init`)

`task init` writes a commented `task.yaml`, a workspace `README.md` (type `workspace-guide`) and a `TASK-TOOL` managed block in `AGENTS.md` (created if missing) plus `CLAUDE.md` and the root `README.md` when they already exist. `task init --refresh-docs` re-syncs these on an existing workspace without replacing a customised workspace guide. Managed blocks are matched by their own marker, so they coexist with blocks written by `task setup`. Implementation: `project/self-docs.ts` and the `task-tool-guide.hbs` / `workspace-readme.hbs` templates (overridable under `<workspace>/agents/templates/`).

## Recoverable delete

`task delete <id> --yes` (tasks, task groups with `--cascade`, documents) moves the item into `os.tmpdir()/taskcode-trash/<project-hash>/<timestamp>-<id>/` (override with `TASK_TRASH_DIR`) with a `manifest.json`. `task undelete <trash-id>` restores it to its original path if that path is free and the content hash still matches; `task trash list` shows what can be restored. Deleting something other tasks depend on needs `--force`; structural documents and group ids passed to the document route are refused. The trash is temporary and may be cleared by the OS. Runtime routes: `DELETE /workspace/task|document|task-groups/:id`, `GET /workspace/trash`, `POST /workspace/trash/:id/restore`.

## Git change tracking

`task start <id> --track` (or `task update <id> --status in-progress --track`) records a snapshot of the working tree in `extra.tracking.segments`. Leaving `in-progress` closes the segment with an end snapshot and a files/insertions/deletions summary; re-entering opens a new segment. Snapshots are commits built with a temporary index and pinned under `refs/task/tracking/<task-id>/`, so the user's index, branches and working tree are untouched. The workspace `todo/` folder is excluded. `task changes <id>` lists changed files with line counts and per-folder totals (live while a segment is open); `--diff <path>` prints one file's diff. Tracking measures a time window, not authorship: concurrent tasks and human edits appear in every overlapping window. Runtime routes: `GET /workspace/task/:id/changes` and `/changes/diff?path=&segment=`.

## Viewing files and diffs

`GET /workspace/project-file?path=` returns one text file under the project root (symlink-checked, 1 MB limit, binaries not shown). Paths such as `.git`, `node_modules`, `.env*` and private keys are refused for files and diffs (`git/deny.ts`). The dashboard highlights code with Shiki (`lib/highlight.ts`, JavaScript regex engine, light and dark themes), renders fenced code blocks and diffs with `CodeViewer`/`DiffViewer`, and opens `/files?path=<path>&L=<from>-<to>`. Markdown links are classified by the shared `resolveLink`: ids and relative workspace paths open `/documents/<id>`, other project paths open the file viewer, external links open in a new tab, and unsafe schemes or paths outside the project are blocked.

## Not yet done

- TUI rendering of diffs and highlighted files (the TUI supports delete and undo).
- Pruning `refs/task/**` for tasks that were permanently removed.
- Split (side-by-side) diff view and editing code files in the dashboard.
