---
id: DEC-0005
name: Client, local runtime, and hosted API architecture
type: decision
status: accepted
created_at: 2026-10-31
---

# Decision 0005: Client, local runtime, and hosted API architecture

> **Supersession note (2026-10-31):** Decision 0006 supersedes decisions 8 and 14 and the intended source layout below only where they prescribe a single `apps/site` application for both local and hosted modes. The current direction is a separate `apps/local` application and `apps/site` hosted website. The remaining decisions in this record continue to apply unless a later decision explicitly supersedes them. See Decisions 0006, 0007, and 0008.

- **Status:** Accepted
- **Date:** 2026-10-31
- **Scope:** CLI, local dashboard, local runtime, TUI, hosted API, website, mobile app, and synchronization

## Context

Task must serve both repository-native local workflows and a hosted multi-user platform. People and AI agents need a dependable CLI for managing tasks and documents. People also need a local visual dashboard for a repository workspace. Separately, Task Cloud needs a deployed API, website, and mobile application. A local CLI must be able to authenticate and synchronize a local workspace with the hosted service when the user chooses.

The product also needs a terminal user interface (TUI) for people who prefer an interactive keyboard-driven terminal experience. The TUI should complement, not replace, the CLI.

## Decisions

1. **Keep the CLI as a first-class interface for people and agents.** It provides commands for workspace discovery, task and document operations, validation, automation, authentication, and synchronization. Both `task` and `tk` invoke the same CLI.
2. **Provide a local management dashboard.** The local dashboard manages the currently selected local Task workspace and remains useful without an account or internet access.
3. **Provide a local runtime/service for local interfaces.** The CLI starts or manages the local runtime used by the dashboard and TUI where appropriate. This runtime owns safe workspace access, file watching, local operations, and a local HTTP/WebSocket interface.
4. **Use WebSocket for live local updates.** The local dashboard subscribes to workspace changes through the local runtime. Changes made through the dashboard, CLI, agents, or external editors are reflected through the runtime's change notifications. WebSocket is a live-update transport, not the synchronization protocol.
5. **Keep local filesystem access out of the browser.** The browser talks to the local runtime over a restricted local interface. The runtime validates requests, limits access to the selected workspace, and must not expose arbitrary filesystem operations. Local access is protected against cross-origin abuse and unauthorized network exposure.
6. **Build the hosted API as a standalone NestJS project at `source/api/`.** It has its own package, dependencies, configuration, application entry point, modules, persistence, and deployment lifecycle. It starts as a modular monolith, not a set of microservices.
7. **Keep hosted API domain modules inside the NestJS application.** Identity, organizations, workspaces, projects, tasks, documents, relationships, authorization, synchronization, search, activity, notifications, and integrations are internal API modules, not separate packages or services by default.
8. **Provide a website at `source/apps/site/`.** The site has two runtime modes:
   - Local mode is served locally and connects to the local runtime for repository-backed workspace access and live updates.
   - Cloud mode is deployed as the public website and connects directly to the hosted API for authenticated cloud work.
   These are distinct runtime/deployment configurations. Share application/UI code where practical, but do not make local mode depend on the hosted API or force cloud mode to use local filesystem access.
9. **Provide a mobile application at `source/apps/mobile/`.** It connects directly to the hosted API using authenticated client contracts. Its framework and exact offline scope remain separate decisions.
10. **Provide a TUI at `source/apps/tui/`.** It is an interactive, keyboard-driven terminal application for people. It uses the same domain/workspace operations as the CLI and local runtime; it must not implement a second task model or bypass validation. It can provide a local workspace experience and, where designed, authenticated cloud workflows through the same API/sync contracts. The CLI remains the primary scriptable and agent-facing interface.
11. **Allow the CLI to connect to Task Cloud.** Users can log in, select or link a cloud workspace, inspect sync status, and synchronize local repository workspaces through the hosted API and a dedicated synchronization protocol. Local-only commands continue to work without login.
12. **Connect hosted clients directly to the hosted API.** The deployed website and mobile app use the global API for cloud data. They do not route ordinary cloud operations through a user's local runtime.
13. **Separate local live updates from cloud synchronization.** The local runtime watches and broadcasts local changes. The synchronization subsystem exchanges authorized, revision-aware changes between a connected local workspace and the hosted API. These are related but separate responsibilities.
14. **Keep the web application boundary intentional.** The local dashboard and hosted website may share one site application with separate runtime modes. Do not create two independent web products unless later requirements demonstrate that their workflows or deployment needs cannot be served cleanly by one application.
15. **Do not scaffold empty applications or speculative shared packages.** Create the API, site, mobile, and TUI projects when their implementation begins. Shared packages are extracted only for real reuse, stable contracts, or an independently justified lifecycle.

## Intended source layout

```text
source/
├── api/                 # Standalone NestJS hosted API
└── apps/
    ├── cli/             # Scriptable CLI for people and agents
    ├── site/            # Local dashboard and hosted website modes
    ├── mobile/          # Hosted mobile client
    └── tui/             # Interactive terminal interface
```

The local runtime is initially owned by the CLI application unless implementation demonstrates a cohesive boundary that should be extracted. The intended layout describes product boundaries; it does not require empty placeholder directories today.

## Local interaction flow

1. A user runs the local dashboard command, such as `task run -p 3004`.
2. The CLI starts the local runtime and serves or launches the site in local mode.
3. The site connects to the runtime over a local HTTP interface and WebSocket.
4. The runtime discovers and accesses only the configured Task-managed workspace.
5. CLI commands, TUI actions, dashboard actions, agents, and external file edits are observed or applied through the local workspace layer.
6. The runtime emits validated change notifications so the dashboard can update without polling or depending on Task Cloud.
7. If the user has linked the workspace to Task Cloud, the synchronization subsystem separately queues and exchanges eligible changes with the hosted API.

## Cloud interaction flow

1. A user signs in through the hosted website, mobile app, or CLI.
2. The hosted API authenticates the principal and enforces workspace/organization authorization.
3. Website and mobile clients access cloud workspaces directly through the API.
4. A connected local CLI synchronizes through the dedicated sync protocol.
5. Local-only workspace operations remain available if the network or hosted API is unavailable.

## Security and reliability requirements

- Bind the local runtime to loopback by default; remote/LAN access requires an explicit, separately secured opt-in.
- Validate browser origin and protect local endpoints against cross-origin request abuse.
- Use a per-runtime capability/token or equivalent local authorization mechanism for sensitive operations and WebSocket subscriptions.
- Restrict all local operations to the selected workspace and explicitly permitted paths.
- Never expose arbitrary filesystem reads, writes, shell execution, or credential access through the local API.
- Treat filesystem watcher events as hints; reconcile against actual workspace state and handle duplicate, missing, or coalesced events.
- Do not assume a WebSocket connection is durable. Clients must be able to reconnect and request a fresh snapshot or cursor-based catch-up.
- Do not treat local WebSocket messages as cloud sync events or as authorization decisions.
- Enforce authentication, authorization, and tenant isolation independently at the hosted API.
- Store cloud credentials outside repository-managed Markdown and ordinary workspace files.

## Consequences

- The CLI remains useful independently of the hosted platform and is the primary agent integration surface.
- The local dashboard gains safe, live access to local workspace changes without giving browser code direct filesystem access.
- The hosted API has an explicit standalone project boundary and deployment lifecycle.
- The website serves both local and hosted use cases while keeping their runtime dependencies separate.
- Mobile is a cloud API client; it does not need access to a local computer's runtime.
- TUI is a separate interactive presentation layer, not a second command engine or domain implementation.
- Local live-update transport and cloud synchronization can evolve and be tested independently.

## Deferred decisions

- Local runtime HTTP framework, port discovery, process lifecycle, and whether it eventually becomes a separate package/application.
- Local authentication token format, origin policy details, and optional LAN access model.
- Exact WebSocket event schema, snapshot/cursor protocol, reconnect behavior, and event coalescing.
- Site framework, build/deployment arrangement, and exact code-sharing boundary between local and hosted modes.
- NestJS modules' internal layering, database engine, migrations, object storage, and deployment infrastructure.
- Authentication provider, session/token lifecycle, and credential storage implementation.
- Mobile framework and offline capabilities.
- TUI framework, rendering library, navigation model, and command palette/keybinding conventions.
- Shared package extraction, API contract generation, and client distribution.
- Sync protocol, revision model, conflict UX, and authority rules for connected workspaces.

These decisions must be recorded before implementation relies on them.
