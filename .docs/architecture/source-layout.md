# Source layout and implementation boundaries

## Purpose

This document defines when code belongs under `source/`. It maps the accepted hybrid product architecture to an implementation tree without turning every conceptual capability into an empty package. Engineering documentation remains under `.docs/`; Task-managed records remain in the configured workspace (default `tasks/`). Do not add a generated `sdk/` directory.

The accepted client/runtime architecture is recorded in [Decision 0005](../../tasks/decisions/0005-client-local-runtime-and-api-architecture.md).

## Current source tree

```text
source/
├── README.md
└── apps/
    └── cli/             # The only implemented application
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts
```

The CLI exposes the `task` and `tk` command names from one entry point. It currently provides the minimal help/version behavior documented in the repository setup guide.

## Intended product source layout

```text
source/
├── api/                 # Standalone NestJS hosted API
│   ├── src/
│   │   ├── modules/     # Internal modular-monolith modules
│   │   └── main.ts
│   └── package.json
└── apps/
    ├── cli/             # Scriptable CLI for people and AI agents
    ├── site/            # Local dashboard + hosted website
    ├── mobile/          # Hosted mobile client
    └── tui/             # Interactive terminal interface
```

This is the intended architecture, not a mandate to create empty directories. Only the CLI is scaffolded today. Add each project when its contracts and implementation are ready.

## Application responsibilities

| Application | Responsibility | Runtime/deployment |
| --- | --- | --- |
| `api/` | Hosted identity, organizations, workspaces, projects, tasks, documents, authorization, sync, search, activity, notifications, integrations | Standalone NestJS service deployed on Task servers |
| `apps/cli/` | Commands for workspace discovery, task/document management, validation, agent workflows, login, linking, and sync | Local executable; local-only use requires no account |
| `apps/site/` | Visual workspace management, cloud collaboration, account and organization workflows | Local mode served on the user's machine; cloud mode deployed as the public website |
| `apps/mobile/` | Focused cross-device access to authorized cloud work | Mobile client connecting directly to hosted API |
| `apps/tui/` | Interactive keyboard-driven terminal workflow for people | Local terminal application; may support authenticated cloud workflows through shared API/sync contracts |

### CLI

The CLI is the primary scriptable interface for both people and agents. It owns command parsing and orchestration. Its local runtime responsibilities initially live inside the CLI application unless implementation demonstrates a real boundary that merits extraction.

The CLI must continue to support local workspace operations without authentication or network access. Cloud commands such as login, workspace linking, and synchronization are optional capabilities.

### Local runtime

The local runtime is started or managed by the CLI. It safely exposes the selected local workspace to local interfaces through HTTP and WebSocket.

It is responsible for:
- discovering and opening the configured Task-managed workspace;
- mediating reads and writes rather than allowing browser code direct filesystem access;
- validating operations against shared document/workspace rules;
- observing changes from CLI commands, TUI, dashboard, agents, and external editors;
- publishing live change notifications to connected local clients;
- exposing a way to obtain a fresh snapshot or catch up after a disconnected client reconnects.

Bind to loopback by default. Do not expose arbitrary filesystem paths, shell execution, credentials, or unrestricted file operations. LAN access, if ever supported, must be an explicit and separately secured mode.

WebSocket is a local live-update channel. It is not the cloud synchronization protocol and does not replace revisions, authorization, idempotency, or conflict handling.

### Site: local and cloud modes

There is one intended site product with two runtime/deployment modes:

- **Local mode:** served locally by the CLI-managed runtime and connected to that runtime's HTTP/WebSocket interface. It manages repository-backed work and remains useful without Task Cloud.
- **Cloud mode:** deployed as the public website and connected directly to the hosted NestJS API for authenticated cloud work.

Share UI and application code where that creates a clean boundary. Keep runtime adapters separate: local mode must not depend on the hosted API, and cloud mode must not depend on a user's local runtime. Do not create two independent web products unless real workflows or deployment requirements later justify that split.

### Mobile

The mobile app connects directly to the hosted API. It must not depend on a local machine being online. Its framework, cache, push notifications, and exact offline capabilities remain open decisions.

### TUI

The TUI is an interactive, keyboard-driven terminal application for people who want a navigable interface rather than issuing individual commands. It complements the CLI; it does not replace the CLI's stable scriptable interface for agents and automation.

The TUI must use the same workspace/domain operations and validation rules as the CLI and local dashboard. It must not create a separate task model, parse/write files through a competing implementation, or bypass the local runtime's workspace boundaries. It can begin as a local workspace interface. Authenticated cloud workflows may be added through the same API and synchronization contracts when those are stable.

Do not introduce a TUI framework or scaffold its app until interaction requirements and the local runtime contract are understood.

## Hosted API module boundaries

The hosted API is a standalone NestJS project under `source/api/`. It starts as one modular monolith, not microservices.

Its conceptual internal modules are identity, organizations, workspaces, projects, tasks, documents, relationships, authorization, synchronization, search, activity, notifications, and integrations.

These are domain/module boundaries inside the API. They are not separate packages or separately deployable services. Create module directories when implementing the corresponding module and its real contracts.

## Shared code and package boundaries

There are no shared package workspaces yet. Do not create one package per noun or product capability.

Introduce a shared package only when:
- a real implementation needs to be reused by at least two consumers, or a stable boundary must be independently versioned;
- its responsibility and public API can be stated precisely;
- its dependency direction is clear; and
- the package contains real code and tests or another concrete verification path, not only a placeholder `index.ts`.

Likely candidates to evaluate when implementation reaches them include domain rules/schemas, document parsing and validation, local workspace operations, synchronization contracts, and hosted API client contracts. These are candidates, not pre-approved package names or a required final package count.

Applications are composition roots. Domain rules must not depend on UI frameworks, databases, Git providers, or network transports. Local repository persistence and cloud persistence are different adapters. Synchronization is an explicit subsystem, not hidden inside document CRUD.

## Local live updates vs cloud synchronization

Keep these responsibilities separate:

- **Local runtime and WebSocket:** observe local workspace changes and notify local dashboard/TUI clients. Support reconnect and snapshot/cursor recovery.
- **Cloud synchronization:** exchange authorized, revision-aware changes between a connected local workspace and Task Cloud. Handle idempotency, deletions, conflicts, retries, and recovery.

A WebSocket event is not automatically a sync operation. Filesystem watcher events are hints and must be reconciled against actual workspace state.

## Dependency and ownership rules

- Applications are composition roots; they wire domain behavior to runtime adapters.
- The NestJS API owns server-side authentication, authorization, and tenant isolation for cloud operations.
- Local-only workflows must not require cloud credentials.
- Hosted website and mobile clients access cloud data directly through the hosted API.
- The local dashboard accesses local files only through the local runtime.
- The CLI can use both the local runtime/domain operations and the hosted API/sync contracts.
- TUI and CLI must share domain operations and validation rather than duplicate them.
- Generated client artifacts must not be committed into a root `sdk/` directory. Client generation/distribution remains a separate decision.

## Implementation sequence

1. Define local document/workspace contracts and implement CLI workspace discovery and validation.
2. Design and implement the CLI-managed local runtime boundary, including safe HTTP/WebSocket access and reconnect behavior.
3. Implement the site in local mode against the local runtime; add hosted mode against stable API contracts.
4. Define cloud identity, ownership, authorization, persistence, and API contracts; implement the standalone NestJS modular monolith under `source/api/`.
5. Design synchronization as its own protocol before connecting repository workspaces to cloud workspaces.
6. Add hosted web workflows and mobile against stable API contracts.
7. Design and add the TUI against the same local workspace/domain operations.
8. Extract shared packages only when real reuse and stable ownership justify them.

A directory's existence is not evidence that a capability is implemented.
