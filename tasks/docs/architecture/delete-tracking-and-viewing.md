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

## Automatic change tracking

Accepted in [Decision 0014](../../decisions/0014-private-tracking-store.md). Moving a task to `in-progress` opens a snapshot window automatically and leaving it closes the window with an end snapshot and a cached summary (`extra.tracking.segments`); re-entering opens a new segment. Snapshots are commits in a private bare git repository per project under the tool data directory (`TASK_DATA_DIR`, otherwise the XDG data directory, `~/Library/Application Support/taskcode` or `%LOCALAPPDATA%\\taskcode`), used with the project as its work tree so `.gitignore` files apply. The project's own `.git` is never written and the project does not need to be a repository; only the `git` executable is required. The store directory has mode 0700, symlinked store paths are refused, built-in ignores and size/file-count limits apply (truncated snapshots are labelled), and the workspace `todo/` folder is excluded. `tracking.enabled: false` in `task.yaml` turns tracking off; `--track` is accepted for compatibility and has no effect. Segments recorded under Decision 0012 (`refs/task/**` in the project repository) stay readable. Tracking measures a time window, not authorship. `task changes <id>` lists files with line counts and per-folder totals (live while a segment is open) and `--diff <path>` prints one file's diff; runtime routes are `GET /workspace/task/:id/changes` and `/changes/diff?path=&segment=`.

## Content-quality policy

Accepted in [Decision 0015](../../decisions/0015-content-quality-policy.md). `task.yaml` `quality` (`mode` reject | warn | off, `minTaskWords`, `minChecklistItems`, `minGroupDocWords`) gates a planned task: a status change out of `planned` fails with `validation_failed` (HTTP 422) unless the task body has a Goal-like and an Acceptance-like section, enough words and checkboxes, no empty headings and no placeholder text, and its group has detailed `goal.md` and `plan.md`. `task validate` reports the same findings with a severity (error in reject mode, warning in warn mode; only errors set a failing exit code). Completed and archived work is exempt. Creating work writes a scaffold, or a full document with `task create --body-file` and `task group create --goal-file/--plan-file`. `task init` writes `rules/task-writing.md` for agents. Implementation: `operations/quality.ts` (pure assessment), `operations/quality-check.ts` (workspace checks), and the gate in `updateTask`.

## Checklists

`documents/checklist.ts` is the single fence-aware, heading-aware checkbox engine shared by the CLI, runtime and dashboard. `task checklist <id>`, `task check|uncheck <id> (--item N | --section "Heading" | --all)` and `GET|POST /workspace/task/:id/checklist` read and tick checkboxes through the safe document replace with an optimistic hash.

## Task sheet

The dashboard task sheet (`components/task-sheet.tsx`) is a Radix dialog over a blurred backdrop, closable with its button, Escape or a backdrop click (with a guard for unsaved edits) and expandable (remembered in `localStorage`). Tabs: Overview, Checklist (checkboxes grouped by heading with progress and bulk controls), Changes (automatic tracking with expandable diffs), Edit, Docs (group goal and plan, dependencies, mentions and links) and Quality (findings against the policy).

## Viewing files and diffs

`GET /workspace/project-file?path=` returns one text file under the project root (symlink-checked, 1 MB limit, binaries not shown). Paths such as `.git`, `node_modules`, `.env*` and private keys are refused for files and diffs (`git/deny.ts`). The dashboard highlights code with Shiki (`lib/highlight.ts`, JavaScript regex engine, light and dark themes), renders fenced code blocks and diffs with `CodeViewer`/`DiffViewer`, and opens `/files?path=<path>&L=<from>-<to>`. Markdown links are classified by the shared `resolveLink`: ids and relative workspace paths open `/documents/<id>`, other project paths open the file viewer, external links open in a new tab, and unsafe schemes or paths outside the project are blocked.

## Not yet done

- TUI rendering of diffs and highlighted files (the TUI supports delete and undo).
- Pruning the private tracking store and old `refs/task/**` refs for tasks that were permanently removed.
- Split (side-by-side) diff view and editing code files in the dashboard.
