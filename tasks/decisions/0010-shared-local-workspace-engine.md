---
id: DEC-0010
name: Shared local workspace engine for CLI and dashboard
type: decision
status: accepted
created_at: 2026-10-31
---

# Decision 0010: Shared local workspace engine for CLI and dashboard

- **Status:** Accepted
- **Date:** 2026-10-31
- **Scope:** Local workspace operations, CLI, local runtime, dashboard, filesystem reconciliation, and local live updates

## Context

Task provides a CLI for people and agents and a local browser dashboard for visual workspace management. These interfaces must manage the same project. Maintaining separate task implementations or separate local data stores would create divergent validation, inconsistent behavior, and synchronization problems.

The local workspace is file-based and must remain usable offline. The CLI must not depend on a running dashboard server. The browser must not receive direct or arbitrary filesystem access.

## Decisions

1. **One workspace engine.** source/packages/workspace is the shared implementation boundary for local workspace discovery, configuration, parsing, validation, queries, and file-backed operations as those capabilities are implemented.
2. **One authoritative local source of truth.** Workspace files remain authoritative. Any indexes or caches are derived and rebuildable; neither the CLI nor local runtime owns a competing task database.
3. **Two interfaces, one operation implementation.** CLI commands call shared workspace operations directly. The local runtime calls those same operations and exposes a restricted HTTP API to the browser. The dashboard never implements independent authoritative task/document rules.
4. **CLI independence.** Ordinary local CLI commands must work when the local runtime is stopped and without network access, a Task account, or the hosted API. Do not route ordinary CLI file operations through local HTTP.
5. **Local runtime as an adapter.** The runtime owns process lifecycle, local HTTP/WebSocket transport, filesystem watching/reconciliation, browser security, and selected-workspace context. It is not the owner of workspace data or domain rules.
6. **Browser isolation.** The dashboard reads and mutates workspace data only through the local runtime's explicit workspace-scoped API. Never expose arbitrary filesystem paths, shell execution, or unrestricted file operations to browser clients.
7. **External change reconciliation.** CLI, agents, and external editors may change workspace files. The runtime must reconcile actual filesystem state and notify connected dashboards. Watcher events are hints, not an authoritative event log.
8. **Live updates are local only.** WebSocket notifications keep local dashboard sessions current. They are separate from durable Task Cloud synchronization between devices.
9. **Protect concurrent edits.** Shared operations must use safe writes and revision/precondition checks. Stale mutations must be rejected or preserved as conflicts rather than silently overwriting newer edits. A process-local lock alone is insufficient for cross-process writers.
10. **Recover missed events.** Dashboard clients must detect event gaps/reconnects and recover using an authoritative workspace snapshot or supported cursor. Duplicate notifications must be safe to process.
11. **Secure the local runtime.** Loopback binding is the default but is not sufficient alone. Before workspace data or mutations are exposed, implement origin validation, per-runtime capability authorization, managed-boundary enforcement, and symlink-aware path protections.
12. **Keep adapters separate from the engine.** Terminal presentation belongs to CLI; HTTP and WebSocket transport belong to the local runtime; browser presentation belongs to the dashboard; hosted identity and cloud persistence belong to the hosted API.
13. **Reuse the engine in future local clients.** The TUI must reuse shared workspace operations and validation rather than introducing another domain model.
14. **Implement incrementally.** Establish workspace discovery and safe shared operations first, then integrate the CLI, local runtime, reconciliation/events, and dashboard. Do not create empty package modules or claim scaffolded capabilities are complete.

## Consequences

- CLI and dashboard operations have consistent validation and file behavior.
- Local project data remains available even when the dashboard/runtime is not running.
- Dashboard browser code cannot access arbitrary filesystem paths.
- External edits can be reflected in connected dashboards through reconciliation and local events.
- Concurrency and missed-event recovery are explicit engineering requirements.
- The local runtime remains an adapter, not a second application backend or local database authority.

## Deferred implementation contracts

- Exact public TypeScript API for workspace operations and domain errors.
- Revision representation, safe-write and cross-process locking strategy.
- HTTP routes, request/response schemas, and error mapping.
- WebSocket event names, envelopes, ordering, and cursor/snapshot protocol.
- Filesystem watcher implementation, reconciliation granularity, and debounce strategy.
- Exact runtime process supervision and browser launch behavior.

These contracts must be defined before the corresponding integration depends on them. See [the detailed architecture](../docs/architecture/local-workspace-engine.md).
