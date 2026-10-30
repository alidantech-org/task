---
id: DEC-0006
name: Separate local and hosted application boundaries
type: decision
status: accepted
created_at: 2026-10-31
---

# Decision 0006: Separate local and hosted application boundaries

- **Status:** Accepted
- **Date:** 2026-10-31
- **Scope:** Local CLI/runtime/dashboard, hosted website, source layout, and application responsibilities
- **Supersedes:** Decision 0005, clauses 8 and 14, and its intended source layout, only where they prescribe one site application with local and cloud runtime modes.

## Context

The earlier architecture treated the local dashboard and hosted website as two runtime modes of one site application. Further design clarified that they have different operating environments and responsibilities:

- The local experience manages files on the user's computer, must work offline without an account, and needs a controlled local runtime.
- The hosted website manages cloud workspaces, accounts, organizations, and collaboration through the hosted API.
- The CLI is the entry point for local workspace operations and starts or manages the local application.

Sharing a visual language or selected components does not require combining these applications or their runtime boundaries.

## Decisions

1. **Separate local and hosted applications.** The local application lives at `source/apps/local/`; the hosted website lives at `source/apps/site/`.
2. **Keep the CLI separate.** The CLI lives at `source/apps/cli/` and remains the primary scriptable interface for people and agents.
3. **Make the local application own the local runtime.** It provides the local dashboard, local HTTP API, WebSocket live updates, filesystem watching/reconciliation, and controlled access to the selected workspace.
4. **Let the CLI start and manage the local application.** A command such as `task run` starts the local runtime and opens or reports the dashboard address. The CLI remains useful when the local application is not running.
5. **Use shared workspace operations, not duplicated business logic.** CLI and local application must use the same workspace rules, parsing, validation, and file operations. Extract a shared package only when real code reuse and a stable boundary justify it; do not create an empty package in advance.
6. **Keep local operation independent.** Local CLI and dashboard workflows require no account, network, or hosted API.
7. **Keep the hosted website cloud-facing.** `source/apps/site/` is deployed at `https://task.alidantech.org` and communicates with the hosted API at `https://task-api.alidantech.org`. It does not depend on a user's local runtime.
8. **Keep the local application local-facing.** It binds to loopback by default, serves the local dashboard, and communicates with local workspace operations. It does not proxy ordinary local work through the hosted API.
9. **Share design and code selectively.** The applications may share design tokens, components, schemas, or domain libraries when justified. They are not required to share complete screens, application state, routing, deployment, or runtime adapters.
10. **Keep mobile separate.** The Flutter mobile application is a cloud client that communicates directly with the hosted API.
11. **Keep the TUI separate.** The future TUI is a terminal presentation layer that reuses workspace operations and validation; it is not a second domain implementation.
12. **Do not scaffold planned applications prematurely.** Build the CLI and local application first. Hosted API, hosted site, mobile, and TUI are added when their implementation stages begin.

## Intended source layout

```text
source/
├── api/                    # Future standalone NestJS hosted API
└── apps/
    ├── cli/                # Scriptable CLI; starts/manages local app
    ├── local/              # Local runtime, HTTP/WS API and dashboard
    ├── site/               # Hosted website
    ├── mobile/             # Flutter cloud client
    └── tui/                # Future interactive terminal interface
```

This is the intended product layout, not a requirement to create empty directories. The current implementation status must be documented separately from the intended structure.

## Local operating flow

1. The user opens a workspace directory and runs `task run` or `tk run`.
2. The CLI discovers and validates the workspace configuration.
3. The CLI starts the local application/runtime for that workspace.
4. The local application binds to loopback, serves the dashboard, and exposes a restricted local HTTP API and WebSocket.
5. The browser communicates only with the local application. It does not receive arbitrary filesystem access.
6. CLI commands call workspace operations directly. Dashboard actions call the same operations through the local HTTP API.
7. Changes made through the CLI, dashboard, agents, or external editors are reconciled and reflected in connected dashboard clients.
8. Stopping the local application does not affect workspace files or ordinary CLI commands.

The initial process lifecycle may be foreground and user-controlled. Background operation is a later convenience, not a prerequisite.

## Local security and reliability

- Bind to loopback by default; do not expose the service to LAN or public interfaces by default.
- Protect local endpoints against cross-origin request abuse and unauthorized browser clients.
- Use a per-runtime capability/token or equivalent local authorization mechanism for sensitive operations and WebSocket subscriptions.
- Restrict operations to the selected workspace and its permitted paths.
- Never expose arbitrary filesystem access, shell execution, or credential access through the local API.
- Treat filesystem watcher events as hints; reconcile actual workspace state.
- Support reconnect and fresh snapshot/cursor recovery for dashboard clients.
- Keep local WebSocket live updates separate from durable cloud synchronization.
- A local server outage must not make the CLI's direct workspace commands unavailable.

## Consequences

- The local dashboard and hosted website can evolve independently around their actual users and runtime requirements.
- The local application has a clear owner for local HTTP, WebSocket, file watching, and browser access.
- The CLI remains a scriptable command interface rather than becoming a mandatory server process for every command.
- Shared code is introduced based on real reuse rather than assumed from the fact that both applications manage tasks.
- The local product can be completed and used before cloud services exist.

## Deferred decisions

- Local HTTP framework, port selection/discovery, process supervision, and browser-launch behavior.
- Exact local HTTP routes, WebSocket event schema, snapshot/cursor protocol, and file watcher implementation.
- UI framework and exact design/component sharing between local and hosted applications.
- Shared package boundaries and API contract generation.
- Hosted website framework and deployment pipeline.
- Authentication provider, OAuth flows, session lifecycle, and credential storage.
- Hosted API persistence, authorization model details, and deployment infrastructure.
- TUI framework and interaction design.

Resolve these details before the corresponding implementation depends on them.
