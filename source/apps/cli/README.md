# Task CLI

The `task` and `tk` executables share one Bun entry point and operate directly on the selected local workspace through `@task/workspace`. They do not require the local runtime or hosted API.

Run from the repository with `bun run dev:cli`. For an editable, machine-wide `task` and `tk` command, run `bun run cli:link`; this uses Bun's package link and points directly at `source/apps/cli` in this checkout. Unlink it with `bun run cli:unlink`. Ensure `$(bun pm bin -g)` is on your shell `PATH`. Start `bun run dev:cli:watch -- info` in a terminal to rerun that command whenever CLI or workspace source files change, then use `task` or `tk` from other terminals and directories. Stop the watcher with Ctrl+C. The global `task` and `tk` commands load the linked source on each invocation, so edits are picked up immediately even without the watcher. Workspace selection follows this order: `--workspace <path>`, `TASK_WORKSPACE_ROOT`, then the nearest ancestor `task.yaml` or `tasks/` directory.

The CLI supports workspace overview and diagnostics, task group creation/listing, task list/show/search/create/update/edit, group archive/restore, workspace validation, document list/show/search/tree/open/create, and index status/rebuild/verify. New tasks use `TSK-` IDs, group plans use `GRP-` IDs, task status defaults to `planned`, and priority defaults to `medium`. Completing the final task in a group archives the whole group under `archive/YYYY/MM/`.

Use `--json` for machine-readable output. JSON success data goes to stdout; diagnostics go to stderr. `--plain`, `--no-color`, and `--quiet` are available for scripts and logs. Non-interactive task/group creation requires explicit options. Set `EDITOR` or `VISUAL` for `task edit` and `task docs open`.

The CLI has no delete/copy/checklist/comment commands, hosted authentication, sync, or browser-facing workspace API. Reads and writes use shared workspace APIs with safe-path preflight; they are not claimed to be race-safe against hostile concurrent filesystem changes.
