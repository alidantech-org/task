---
id: DOC-ARCHITECTURE-LOCAL-WORKSPACE-ENGINE
name: Local Workspace Engine
type: documentation
tags:
  - engineering
---

# Shared local workspace engine and CLI/dashboard collaboration

## Purpose

The CLI and local dashboard are two interfaces to the same workspace engine and the same workspace files. They are not separate task managers, must not duplicate task/document rules, and must not maintain competing local databases.

This is the intended architecture, not a claim that all capabilities are implemented.

## 1. Core model

A Task workspace is a project directory with a Task configuration file and a configured managed-content boundary. Files are authoritative for local project data. The default managed directory is tasks/; a workspace may configure .tasks/ or tasks/docs/. Task metadata/frontmatter rules apply only inside that configured boundary. Ordinary Markdown and unrelated files outside it remain ordinary files. Git is optional. Local workflows must work without an account, network, hosted API, or dashboard process.

Caches and indexes may be used for performance, but must be derived and rebuildable rather than a competing source of truth.

## 2. Responsibilities

### Shared workspace engine — source/packages/workspace

Owns reusable local behavior: workspace discovery/configuration, managed-boundary resolution, safe path handling, task/document parsing and serialization, create/read/update/delete/query operations, metadata validation, stable identities and revisions, safe writes, conflict detection, and reusable reconciliation primitives.

It does not own terminal formatting, browser components, HTTP routing, WebSocket transport, process supervision, or hosted authentication. The current package contains only a lexical path-containment helper; that is not a complete security boundary. Real filesystem operations must add symlink-aware checks, managed-boundary enforcement, and safe writes.

### CLI — source/apps/cli

The CLI is the scriptable interface for people, shell scripts, automation, and AI agents. It discovers the workspace, calls shared operations directly in-process, formats human or machine-readable output, returns meaningful exit codes, and remains useful while the local runtime is stopped. A command such as task run may start/manage the local application, but ordinary CLI commands must not depend on it or call its HTTP API to access local files.

### Local runtime — source/apps/local

The runtime is the controlled bridge between the browser and one selected workspace. It calls the shared engine, exposes a narrow workspace-scoped HTTP API, publishes local change notifications over WebSocket, reconciles filesystem changes from CLI/agents/external editors, and enforces browser origin checks, runtime capability authorization, request validation, and path restrictions. It binds to loopback by default. It is an adapter, not the owner of workspace data or domain rules.

### Local dashboard — source/apps/local browser UI

The dashboard reads and mutates data only through the local runtime API. It renders server-confirmed results and validation errors, subscribes to change notifications, and recovers from disconnects using an authoritative snapshot or supported cursor. It must not access arbitrary local files or implement independent authoritative task/document rules. Client validation may improve usability; shared engine validation remains authoritative.

### Other clients

Agents use the CLI or a future supported machine interface. External editors may change workspace files and must be reconciled by the runtime. The TUI reuses the same engine rather than introducing another domain model.

## 3. Logical architecture

~~~text
                     One selected Task workspace
           task.yaml + managed files + project documents
                              |
                 authoritative local filesystem
                              |
                    shared workspace engine
                    source/packages/workspace
                              |
             +----------------+----------------+
             |                |                |
           CLI          Local runtime         TUI
             |                |
       terminal output   restricted HTTP API
                              |
                       browser dashboard

External editors and agents may change files; filesystem reconciliation
notifies connected dashboard clients.
~~~

This is a logical dependency model. Not every operation passes through a running server.

## 4. Two operation paths

### CLI path

1. Determine the selected workspace.
2. Load and validate its configuration.
3. Call a typed operation in @task/workspace directly.
4. Validate the requested change and current workspace state.
5. Perform a safe filesystem operation.
6. Return a typed result, including record identity/revision where applicable.
7. Format output for a person or automation caller.

The local runtime is not involved.

### Dashboard path

1. Browser sends a typed request to the local runtime.
2. Runtime validates the client and checks the operation against its selected workspace.
3. Runtime calls the same @task/workspace operation used by the CLI.
4. Shared operation validates and safely updates workspace files.
5. Runtime returns the result and publishes a change notification.
6. Dashboard updates from the confirmed result/event or requests a fresh snapshot.

The HTTP controller is an adapter, not a second implementation of workspace rules.

## 5. Example: same task from both interfaces

A command such as:

~~~bash
task update TASK-001 --status done
~~~

calls the shared update operation directly. It validates the task and status, safely writes the file, and returns the new revision. The local runtime reconciles the change and emits a WebSocket event; the open dashboard updates without a manual refresh.

For a dashboard edit, the browser sends an update request to the runtime, which calls the same shared operation. The file changes once; the next CLI read sees the updated value. A human and an agent are editing one project, not synchronizing two copies.

## 6. Shared package boundaries

A possible eventual organization is:

~~~text
source/packages/workspace/
├── src/
│   ├── config/          # discovery and configuration
│   ├── filesystem/      # safe readers, writers, inventory
│   ├── tasks/           # task parsing, queries and operations
│   ├── documents/       # managed document operations
│   ├── validation/      # metadata and schema validation
│   ├── identity/        # stable workspace/record identities
│   ├── revisions/       # revisions and optimistic concurrency
│   ├── operations/      # cohesive public use cases
│   └── index.ts         # deliberate public API
└── package.json
~~~

This is a future organizational direction, not a request to create empty folders. Add modules when real implementation and stable responsibilities justify them.

| Concern | Owner |
| --- | --- |
| Terminal formatting, prompts, shell completion, exit codes | CLI |
| HTTP routes, DTO transport, local process lifecycle | Local runtime |
| WebSocket connections, subscriptions, delivery | Local runtime |
| React views, browser state and interaction | Dashboard |
| Hosted identity, organisations, cloud authorization/persistence | Hosted API |
| Flutter/Dart behavior | Mobile app |

@task/contracts may hold transport-neutral TypeScript types. Transport-specific DTOs/events remain explicit contracts and must not leak into core filesystem/domain operations. Flutter does not import TypeScript packages; cross-language API contracts require a language-neutral schema or Dart generation/maintenance.

## 7. Workspace selection and context

Every operation receives an explicit workspace context. Discovery supports walking upward from the current directory to a valid workspace root and an explicit path option for scripts/agents. Missing or ambiguous workspaces produce clear errors. The selected root and managed boundary are validated and rechecked when configuration changes.

A runtime instance is bound to one selected workspace unless a future multi-workspace runtime design is separately accepted. Browser input cannot change its root by supplying arbitrary paths.

## 8. Safe writes and concurrent editing

CLI, dashboard, agents, and external editors can write concurrently. The engine must:

- Use safe writes, including temporary files and atomic replacement where supported.
- Revalidate the target and managed boundary immediately before mutation.
- Track stable record IDs independently of paths.
- Use revisions, content hashes, or equivalent preconditions for updates.
- Reject stale updates as conflicts or preserve both versions; never silently overwrite newer work.
- Preserve identity across supported moves/renames.
- Make deletion explicit and recoverable under the workspace retention policy.
- Avoid treating watcher events as a complete ordered change log.

A process-local mutex is insufficient because other processes/editors can write files. Cross-process coordination and revision checks are required. The exact locking strategy and revision format can be chosen during implementation; lost-update prevention is mandatory.

## 9. Filesystem watching and reconciliation

Watcher events are hints, not truth: they may be duplicated, reordered, coalesced, or missed. The runtime should debounce/coalesce notifications, reconcile actual filesystem state through shared operations, derive domain-level change descriptions, and publish them. If watcher overflow/restart creates uncertainty, perform broader reconciliation and issue a snapshot-reset notification. Dashboard-originated writes must also publish changes; do not rely solely on watcher behavior for runtime-owned writes.

## 10. Local HTTP API and WebSocket

The HTTP API exposes use cases, not arbitrary filesystem primitives. Expected categories are runtime health/workspace summary, workspace snapshot/query, task/document reads and mutations, validation/preflight, and snapshot version/change cursor.

Do not expose arbitrary file read/write, arbitrary path traversal, shell execution, or unrestricted directory listing.

WebSocket events describe domain changes, not raw OS watcher notifications. An event envelope should eventually include event type, workspace identity, stable record identity where relevant, resulting revision/change cursor, minimal change metadata, and a way to detect gaps and request a fresh snapshot. Exact routes, DTOs, event names and cursor format must be defined before dashboard integration. Clients must never assume every event was received.

## 11. Live updates and recovery

The initiating browser may apply a confirmed mutation response. Other browser sessions receive the event. CLI/agent/external-editor changes are reconciled and published. Duplicate events are safe to process; revisions/cursors let clients ignore stale events. On reconnect, cursor gap, overflow, or reset, the dashboard obtains a fresh authoritative snapshot. The UI distinguishes pending, saved, conflict, and disconnected states and never reports success before confirmation.

WebSocket updates are local UI synchronization only. They are not Task Cloud's durable multi-device sync protocol, which has separate replica identities, cursors, authorization, and conflict handling.

## 12. Local runtime security

Before exposing workspace data or mutations:

- Bind to loopback by default.
- Validate browser origins and protect against cross-origin request abuse.
- Use a per-runtime capability/token or equivalent authorization for sensitive HTTP operations and WebSocket subscriptions.
- Do not put reusable secrets in URLs, browser-visible logs, or workspace files.
- Restrict operations to the runtime's selected workspace and managed boundary.
- Defend against symlink escapes, including symlink changes between validation and use where practical.
- Validate requests against explicit schemas and operation permissions.
- Do not expose shell execution, credential access, or unrestricted filesystem APIs.
- Apply request-size/resource limits; shut down cleanly and invalidate runtime capabilities.

Loopback alone is not a complete security boundary. Origin validation, capability authorization, path containment, and operation-level restrictions are all required.

## 13. Errors and observability

The engine exposes well-defined domain errors: missing/invalid workspace, path outside boundary, missing record, validation failure, stale revision/conflict, authorization failure, and filesystem failure. The CLI maps these to readable messages, structured output when requested, and exit codes. The runtime maps them to stable HTTP errors. The dashboard shows actionable messages without exposing sensitive absolute paths or stack traces.

Logs should include stable workspace ID where available, operation, outcome, and correlation/request ID. Do not log document contents, credentials, or sensitive data by default.

## 14. Verification requirements

Tests must prove that both interfaces use the same engine and files:

1. CLI-created task appears in dashboard.
2. Dashboard-created task appears in CLI.
3. CLI update appears in an already-open dashboard.
4. Dashboard update appears in a subsequent CLI read.
5. External-editor change is reconciled and appears in dashboard.
6. Invalid metadata is rejected consistently.
7. Stale concurrent update is rejected or preserved as conflict.
8. Traversal/symlink escape cannot reach outside the workspace.
9. Runtime cannot be redirected to another workspace by browser input.
10. Reconnect after missed events recovers from a fresh snapshot.
11. CLI continues when runtime is stopped.
12. Local workflows work offline and without a Task Cloud account.

Use temporary workspace fixtures and filesystem-level integration tests.

## 15. Implementation sequence

1. Workspace discovery/context, configuration, managed-boundary validation, stable workspace identity.
2. Typed shared engine operations and domain errors in @task/workspace.
3. Safe file operations, symlink-aware checks, stable record IDs, revisions and conflict handling.
4. CLI integration with human and machine-readable output.
5. Local runtime HTTP adapter and origin/capability security before exposing data or mutations.
6. Filesystem reconciliation and domain-level change descriptions.
7. WebSocket event envelopes/cursors, duplicate/gap handling and snapshot recovery.
8. Dashboard integration with server-confirmed operations and live updates.
9. Cross-interface, external-editor, concurrency and offline verification.
10. TUI reuse after the engine API stabilizes.

Do not build a second task model in the runtime/dashboard, route ordinary CLI commands through HTTP, or add a database as a competing local authority.

## 16. Current implementation status

The CLI resolves a local workspace from `--workspace`, `TASK_WORKSPACE_ROOT`, nearest `task.yaml`, or nearest `tasks/` directory. It uses `@task/workspace` for Markdown indexing, task/document queries, search, validation, safe task/group creation and updates, and group archive/restore. There is no persistent index cache. Full-text search reads document bodies at query time.

Task groups use `todo/<slug>/plan.md` and numbered task records. The last completion archives a non-empty group under `archive/YYYY/MM/YYYY-MM-DD-<slug>/`; explicit archive checks eligibility and restore uses the stable group ID. CLI `edit` and `docs open` edit a temporary body copy and submit changes through the shared hash-checked write operation.

The local dashboard reads indexed summaries, document bodies, full-text search results, task groups, and validation diagnostics through the loopback runtime. The Next.js server proxies browser requests and stores the runtime capability in an HttpOnly, SameSite cookie; direct browser-origin requests to workspace routes are rejected, and mutating proxy requests require a same-origin Origin header. The dashboard creates task groups and tasks and updates task status/due dates through shared workspace operations. Updates include an expected content hash, use atomic replacement, reject symlink path segments, and recheck the target and parent before rename. This narrows filesystem races but is not a kernel-enforced directory-handle boundary against a hostile process concurrently replacing ancestors. The dashboard includes list/board/calendar views, workspace-wide Markdown search, and system/light/dark themes. The TUI currently has a navigation shell and does not yet expose these CLI workflows.

## 17. Shared Markdown index foundation

`@task/workspace` accepts an explicit resolved root; repository discovery and `task.yaml` parsing remain separate. It scans Markdown files, skips configured generated/dependency directories and symlinks, parses frontmatter summaries, and reports invalid documents as diagnostics without discarding valid entries. The `type` field classifies records, including `documentation` documents in `tasks/docs/`. Full bodies are loaded only through an explicit safe-path-checked read operation.

Reconciliation inventories the filesystem and reuses cached summaries when file identity, size, modification time, and change time are unchanged. Changed files are read, hashed, and reparsed; deletions leave the in-memory index. The optional watcher coalesces hints and reconciles against disk. Missing filenames, watcher errors, and periodic checks trigger full snapshot reconciliation. Callers can also request reconciliation and must treat events as hints rather than a durable change log.

The CLI uses the shared index locally for summaries, queries, and validation. The local runtime's health-only HTTP API does not expose workspace data. Persistent caching remains deferred until startup and reconciliation measurements justify it. Indexing does not make reads/writes race-safe; browser workspace routes remain gated on origin/capability authorization and safe operation-boundary filesystem protections.

Implement incrementally and keep this status accurate as capabilities land.
