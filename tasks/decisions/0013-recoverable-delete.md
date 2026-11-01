---
id: DEC-0013
name: Recoverable delete through an OS temp trash
type: decision
status: accepted
created_at: 2026-11-01
---

# Decision 0013: Recoverable delete through an OS temp trash

- **Status:** Accepted
- **Date:** 2026-11-01
- **Scope:** Deleting tasks, task groups and documents from the CLI, TUI and local dashboard

## Context

Archive and restore exist for tasks and groups, but there is no way to remove a task or document. A destructive delete must be recoverable and must not affect the project.

## Decisions

1. **Delete moves the item to a trash directory outside the project**, `os.tmpdir()/taskcode-trash/<project-hash>/<timestamp>-<id>/`, overridable with `TASK_TRASH_DIR`. A `manifest.json` records id, kind, original workspace-relative path, content hash and deletion time.
2. **Undo restores to the original path** and refuses if that path is occupied or the manifest does not match the payload.
3. **The trash is temporary.** The OS may clear it (for example on reboot where `/tmp` is tmpfs). Delete output states this.
4. **Guards:** deleting an item that other tasks list in `depends_on` requires `--force`; deleting a non-empty group requires `--cascade`; structural documents such as the workspace README cannot be deleted.
5. **Non-interactive use requires `--yes`.** JSON output and stable exit codes are preserved.
6. **All surfaces call one shared operation** in `@task/workspace`, with symlink-aware path checks on the source.

## Consequences

- A cross-device move (`EXDEV`) falls back to copy, verify, then remove.
- Archive remains the long-lived soft option; delete is for removal with a short undo window.
