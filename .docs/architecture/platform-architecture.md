# Task platform architecture

## Product direction

Task is a local-first task and project work platform for individuals and organisations. Local workflows work without an account, network, Git repository, or hosted service. Cloud workspaces and collaboration are optional additions.

The platform has separate product surfaces:

- CLI: scriptable local interface for people and AI agents.
- Local application: local runtime and browser dashboard for a selected file-based workspace.
- Hosted website: cloud client at task.alidantech.org.
- Hosted API: standalone NestJS modular monolith at task-api.alidantech.org.
- Mobile: Flutter application connecting directly to the hosted API.
- TUI: terminal interface reusing local workspace operations.

## Accepted architecture decisions

- [0004 — Hybrid cloud platform](../../tasks/decisions/0004-hybrid-cloud-platform.md)
- [0005 — Client, local runtime, and hosted API](../../tasks/decisions/0005-client-local-runtime-and-api-architecture.md)
- [0006 — Separate local and hosted application boundaries](../../tasks/decisions/0006-local-and-hosted-application-boundaries.md)
- [0007 — File-based local workspaces and optional Git](../../tasks/decisions/0007-file-based-local-workspaces.md)
- [0008 — Two-way multi-device synchronization](../../tasks/decisions/0008-multi-device-two-way-sync.md)
- [0009 — Bun monorepo, application scaffolds, and shared packages](../../tasks/decisions/0009-bun-monorepo-and-shared-packages.md)
- [0010 — Shared local workspace engine for CLI and dashboard](../../tasks/decisions/0010-shared-local-workspace-engine.md)
- [Shared local workspace engine and CLI/dashboard collaboration](local-workspace-engine.md)

## Product and runtime boundaries

| Surface | Responsibility | Connectivity |
| --- | --- | --- |
| CLI | Workspace discovery, task/document operations, validation, automation and later cloud commands | Local commands work offline and without the local server |
| Local app | Browser dashboard, local HTTP API, WebSocket, file watching/reconciliation and controlled workspace access | Local computer; loopback by default |
| Hosted website | Accounts, personal workspaces, organisations and collaboration | Hosted site calls hosted API directly |
| Hosted API | Identity, authorization, cloud workspaces, persistence and future sync | Standalone NestJS modular monolith |
| Flutter mobile | Access to authorised cloud workspaces | Direct hosted API client |
| TUI | Keyboard-driven local interface | Reuses shared workspace operations |

The local application and hosted website are separate applications. Both use React + Vite + TypeScript, but have separate entry points, runtime responsibilities, state, routing, and deployment. Shared tooling does not merge their product boundaries.

## Repository tooling

The repository root package.json manages one Bun workspace containing source/api, source/apps/*, and source/packages/*. Each Bun-managed app/package keeps its own package.json. Root scripts orchestrate the CLI, local runtime/dashboard, hosted site, API, TUI, and typechecking.

The Flutter app under source/apps/mobile is outside the Bun workspace and is managed through pubspec.yaml and Flutter tooling. Dart code does not import TypeScript packages; cross-language contracts must be generated from a language-neutral source or maintained for Dart.

The source tree and current scaffold status are documented in [source layout](source-layout.md).

## Shared packages

source/packages contains real reusable code, not empty placeholders. Initial packages are @task/contracts for transport-neutral TypeScript contracts and @task/workspace for local workspace primitives. Add packages only for real shared implementation or a stable contract with actual consumers. Avoid a catch-all package.

## Local workspace model

Workspace records are stored in files; files are authoritative for local data. Git is optional and independent of Task Cloud sync. Root task.yaml selects the managed workspace boundary; the default is tasks/. Task Markdown frontmatter applies only inside the configured boundary. Ordinary Markdown elsewhere remains ordinary Markdown.

The CLI performs ordinary local workspace operations directly and remains usable if the local app is stopped. The local application exposes shared operations to the browser through a restricted local HTTP API. The browser never receives arbitrary filesystem access.

The current local runtime scaffold binds to loopback and exposes only a health endpoint. Before exposing workspace data or mutations, implement workspace-scoped operations, symlink-aware path protections, origin/capability security, and managed-boundary validation. WebSocket live updates and CLI-managed process lifecycle are not implemented yet.

## Ownership and workspace modes

Keep users, personal workspaces, organisations, organisation workspaces, projects, tasks/documents, memberships, and device replicas as distinct concepts. A user may own personal workspaces and belong to multiple organisations. My Work is an authorised cross-project view, not a separate task store.

Supported product modes:
- Local: file-based workspace with no account or network requirement.
- Connected: local files remain usable offline and explicitly sync with a cloud workspace.
- Cloud-native: workspace is managed in Task Cloud without a local replica and remains exportable.

## Future two-way multi-device sync

Task Cloud must support two-way changes between a cloud workspace and multiple local replicas. Each replica has independent device identity and sync progress. The protocol must provide stable workspace/record IDs, revisions and cursors, idempotent retries, tombstones, conflict detection and preservation, explicit initial reconciliation, permission revocation, and interrupted-session recovery.

Never silently overwrite work or assume universal last-write-wins. Git history, local WebSocket updates, and Task sync are separate mechanisms. The sync engine is a later phase; the local product must first establish safe file operations and stable identity foundations.

## Implementation sequence

1. Define workspace configuration, file/document contracts, stable IDs, discovery and validation; implement useful CLI operations.
2. Implement shared local workspace operations.
3. Implement local runtime security, HTTP/WebSocket contracts, filesystem reconciliation and CLI-managed lifecycle.
4. Build the local dashboard against the local runtime and verify bidirectional updates, including external file edits.
5. Harden local integrity, recovery and offline behavior.
6. Define cloud identity, ownership, authorization, persistence and API contracts.
7. Implement the hosted NestJS API and hosted website.
8. Design and implement two-way multi-device sync.
9. Build the Flutter mobile client against stable API contracts.
10. Expand the TUI using established workspace operations.

## Current implementation status

Starter projects now exist for the CLI, local application, hosted site, NestJS API, Flutter mobile app, TUI, and two shared TypeScript packages. They are scaffolds only. The local runtime currently has a health endpoint; the browser applications are starter screens; the API has no domain persistence or authentication; the CLI and TUI have no full task workflows; and sync is not implemented.

Do not treat project setup as feature completion. See [source layout and implementation boundaries](source-layout.md) for the precise file inventory and current limitations.
