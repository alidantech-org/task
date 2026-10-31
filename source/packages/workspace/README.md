# @task/workspace

Shared local workspace engine for the CLI, TUI and local runtime. The CLI resolves a workspace with `resolveWorkspace`, then calls this package's query, search, validation, task/group creation/update, archive and restore operations. `buildWorkspaceIndex` scans Markdown into metadata summaries and validation diagnostics; `reconcileWorkspaceIndex` inventories files and reuses summaries when device, inode, size, modification time, and change time match. Changed files are hashed with SHA-256 and reparsed. `readWorkspaceDocument` loads a full body on demand after path checks.

Implementation is organized by responsibility:

```text
src/
├── discovery/scan.ts       # Recursive Markdown discovery
├── discovery/ignore.ts    # Generated/dependency directory exclusions
├── indexing/index.ts      # Public index operations and types
├── indexing/incremental.ts # Initial scan and reconciliation
├── indexing/metadata.ts   # Frontmatter parsing and content hashing
├── watching/watcher.ts    # Debounced watch events and recovery scans
├── documents/read.ts      # Safe on-demand body reads
├── documents/classify.ts  # Frontmatter type classification
├── paths/safe-path.ts     # Lexical and symlink-aware path checks
└── project/               # Static inspection, setup planning, and Handlebars templates
```

There is intentionally no `cache.ts`: a persistent cache is deferred until startup measurements justify it. Internal module references use the package's explicit subpath exports so consumers can typecheck workspace modules without inheriting the consuming app's `#/` TypeScript path mapping.

`watchWorkspaceIndex` is optional. It coalesces filesystem notifications, reconciles against disk, reports typed added/updated/removed/reset events, and can run periodic reconciliations. Missing filenames and watcher errors cause a reset. Filesystem notifications are hints; callers can invoke `reconcile()` at any time. Close the watcher when its owner shuts down.

The scanner ignores `.git`, `.task`, `.tasks-cache`, `.cache`, `node_modules`, `vendor`, `build`, `dist`, `.next`, `.dart_tool`, `coverage`, `tmp`, and `temp` directories, and does not follow symlinks. Documents are classified by metadata `type`; documentation under `tasks/docs/` is included normally. The metadata reader validates common identity, tags/extra shape, task status and priority enums, task field types, and supported decision fields. Workspace validation also checks duplicate IDs, dependency references/cycles, group layout, and local Markdown links. Invalid Markdown remains visible through diagnostics and does not prevent other files from indexing.

Task files are created as numbered Markdown records inside `todo/<group-slug>/`; `plan.md` carries the `GRP-` group ID. The final completed task archives a non-empty group under `todo/_archive/YYYY/MM/YYYY-MM-DD-<slug>/`. Explicit group archive requires all tasks to be complete; restore resolves by group ID and returns the group to its active slug. This new project layout does not support or migrate a workspace-root `archive/` directory. Updates preserve document bodies and use hash checks with temporary-file replacement. These checks reduce accidental overwrite and path escape risk but do not make filesystem operations race-safe.

`inspectProject()` performs static file inspection only: it reads manifests and known configuration files, records evidence paths, skips common generated directories and `.gitignore` matches, and never runs project scripts or contacts services. `createProjectSetupPlan()` renders reviewed Markdown from built-in Handlebars templates, with optional user overrides in `tasks/agents/templates/`. `applyProjectSetupPlan()` constrains targets, rejects symlinked path components, preserves content outside managed sections, and reports existing unmarked generated files as conflicts rather than replacing them. Inspection and plan generation are read-only. No agent is launched and no Git setting or hook is changed.

There is no persistent index cache. `index rebuild` performs an authoritative fresh scan, while `index verify` runs workspace validation. Search currently reads Markdown bodies on demand and is not backed by a content index. Browser-facing workspace access remains deferred until local-runtime origin/capability authorization and safe operation-boundary protections are complete.

The index is in-memory and read-only. There is no persistent cache or full-text search. Path preflight checks do not claim race-safe file operations. Browser routes must not expose indexed content until runtime origin/capability authorization and operation-boundary filesystem protections are implemented. The package has no UI or transport dependencies.
