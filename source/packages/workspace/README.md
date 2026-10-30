# @task/workspace

Shared local workspace primitives for the CLI, TUI and local runtime. Callers provide an explicit resolved workspace root. `buildWorkspaceIndex` scans Markdown into metadata summaries and validation diagnostics; `reconcileWorkspaceIndex` inventories files and reuses summaries when device, inode, size, modification time, and change time match. Changed files are hashed with SHA-256 and reparsed. `readWorkspaceDocument` loads a full body on demand after path checks.

`watchWorkspaceIndex` is optional. It coalesces filesystem notifications, reconciles against disk, reports typed added/updated/removed/reset events, and can run periodic reconciliations. Missing filenames and watcher errors cause a reset. Filesystem notifications are hints; callers can invoke `reconcile()` at any time. Close the watcher when its owner shuts down.

The scanner ignores `.git`, `.task`, `.tasks-cache`, `.cache`, `node_modules`, `vendor`, `build`, `dist`, `.next`, `.dart_tool`, `coverage`, `tmp`, and `temp` directories, and does not follow symlinks. Documents are classified by metadata `type`; documentation under `tasks/docs/` is included normally. The initial metadata reader validates the required `id`, `name`, and `type` fields and tag shape; it is not yet the complete future Task schema registry. Invalid Markdown remains visible through diagnostics and does not prevent other files from indexing.

The index is in-memory and read-only. There is no persistent cache or full-text search. Path preflight checks do not claim race-safe file operations. Browser routes must not expose indexed content until runtime origin/capability authorization and operation-boundary filesystem protections are implemented. Internal imports use `#/…`; the package has no UI or transport dependencies.
