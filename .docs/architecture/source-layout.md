# Source layout and implementation boundaries

## Purpose

This document maps the accepted Task product architecture to source-code ownership. It deliberately distinguishes the current implementation from intended future applications. Do not create empty application directories or speculative shared packages. Engineering documentation belongs in `.docs/`; Task-managed records belong in the configured workspace (default `tasks/`). Do not add a generated root `sdk/` directory.

Architecture decisions:
- [0005 — Client, local runtime, and hosted API](../../tasks/decisions/0005-client-local-runtime-and-api-architecture.md)
- [0006 — Separate local and hosted application boundaries](../../tasks/decisions/0006-local-and-hosted-application-boundaries.md)
- [0007 — File-based local workspaces and optional Git](../../tasks/decisions/0007-file-based-local-workspaces.md)
- [0008 — Two-way multi-device synchronization](../../tasks/decisions/0008-multi-device-two-way-sync.md)

## Current source tree

```text
source/
├── README.md
└── apps/
    └── cli/                 # Only implemented application
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts
```

The CLI exposes `task` and `tk` from one entry point. Its current capability is limited to the minimal help/version behavior. The local runtime, dashboard, hosted API, hosted website, mobile app, and TUI are not implemented yet.

## Intended product source layout

```text
source/
├── api/                     # Future standalone NestJS hosted API
└── apps/
    ├── cli/                 # Scriptable CLI for people and agents
    ├── local/               # Local runtime, HTTP/WS API and browser dashboard
    ├── site/                # Hosted website: task.alidantech.org
    ├── mobile/              # Flutter cloud client
    └── tui/                 # Future interactive terminal interface
```

This is the intended architecture, not a mandate to create empty directories. Build the CLI and local application first. Add the hosted API, hosted website, mobile, and TUI when their implementation stages begin.

## Application responsibilities

| Application | Responsibility | Runtime/deployment |
| --- | --- | --- |
| `api/` | Hosted identity, organisations, workspaces, projects, records, authorization, cloud persistence and sync endpoints | Standalone NestJS modular monolith at `task-api.alidantech.org` |
| `apps/cli/` | Workspace discovery, task/document commands, validation, agent workflows, and later login/link/sync commands | Local executable; ordinary local commands need no server, account, or network |
| `apps/local/` | Local dashboard, local HTTP API, WebSocket live updates, filesystem watching/reconciliation, and controlled workspace access | Started or managed by the CLI; loopback-only by default |
| `apps/site/` | Hosted account, personal workspace, organisation, project and collaboration experience | Hosted at `task.alidantech.org`; connects directly to hosted API |
| `apps/mobile/` | Focused mobile workflows for authorised cloud workspaces | Flutter application connecting directly to hosted API |
| `apps/tui/` | Keyboard-driven terminal interface for people | Future local interface reusing the same workspace operations |

The local and hosted applications are separate products/runtime boundaries. They may share design tokens, components, schemas, or domain code when that reuse is real and useful. They do not need identical screens, routing, application state, or deployment arrangements.

## CLI and shared workspace operations

The CLI is the primary scriptable interface for people and AI agents. It must work without the local application running. Commands invoke workspace operations directly rather than routing every command through an HTTP server.

The local application exposes the same workspace capabilities to the browser through its restricted local HTTP API. CLI and local application must not implement competing task/document rules. Extract shared code only when both applications have real reuse and the package boundary is clear; do not pre-create an empty package solely to express an architectural intention.

Local CLI commands remain independent of authentication and connectivity. Cloud login, workspace linking, and synchronisation are later optional capabilities.

## Local application and runtime

The CLI starts or manages the local application, for example through `task run` or `tk run`.

The local application owns:
- the local browser dashboard;
- a restricted local HTTP API for dashboard operations;
- a WebSocket channel for live local updates;
- workspace file watching and reconciliation;
- controlled access to the selected workspace;
- reconnect and snapshot/cursor recovery for dashboard clients.

The browser never receives arbitrary filesystem access. Bind to loopback by default, validate browser origins, protect sensitive operations with a per-runtime capability/token or equivalent, and restrict operations to the selected workspace. Do not expose arbitrary file paths, shell execution, credentials, or unrestricted filesystem operations.

CLI commands should continue to work if the local server stops. Stopping the server must not alter or remove workspace files. A foreground process is sufficient for the first implementation; background service management can be considered later.

WebSocket is for local dashboard live updates. It is not the cloud synchronization protocol. Filesystem watcher events are hints and must be reconciled against actual workspace state. Reconnecting clients must be able to obtain a fresh snapshot or catch up from a cursor.

## Hosted API and website

The hosted API is a standalone NestJS project at `source/api/`, initially a modular monolith. Its public base domain is `https://task-api.alidantech.org`.

The hosted website at `https://task.alidantech.org` communicates directly with the hosted API. It does not depend on a user's local runtime. OAuth and account/session details are deferred to the cloud implementation phase; local-only use must never require signing in.

The API's conceptual modules (identity, organisations, workspaces, projects, tasks, documents, authorization, synchronization, search, activity, notifications, and integrations) remain internal modules of the NestJS application, not separate services by default.

## Mobile and TUI

The mobile application is planned in Flutter and connects directly to the hosted API. It does not require a local computer or local runtime to be online.

The TUI is a future interactive terminal interface for people. It complements the scriptable CLI and must reuse the same workspace operations and validation rather than creating a second task model.

## Local files and Git

Local workspace records are stored in files using the Task Markdown/YAML metadata contract. Files are authoritative for local workspace content.

Git is optional. A Task workspace may live inside a Git repository, but it may also be a normal directory. When Git is present, Task should work naturally with it without taking ownership of the user's Git history or requiring Git for ordinary operations.

The root `task.yaml` configures the workspace and identifies the Task-managed content boundary. The default managed folder is `tasks/`; a workspace may configure another folder such as `.tasks/` or `.docs/`. Task frontmatter rules apply only inside that configured boundary. Ordinary Markdown elsewhere remains ordinary Markdown, and unrelated project files must not be rewritten.

Derived local indexes or caches may be introduced when justified, but they must not become a competing authoritative store for workspace records.

## Future two-way, multi-device synchronization

Task Cloud must eventually support two-way synchronisation between one cloud workspace and multiple local replicas on different computers. Each replica has its own device/client identity and sync progress. Each local copy remains usable offline.

The sync protocol must provide:
- stable workspace and record identifiers independent of paths;
- device/replica registration and per-replica progress;
- revisions and incremental change cursors;
- idempotent, retryable change exchange;
- explicit deletion/tombstone semantics;
- conflict detection and preservation of both versions;
- initial reconciliation and explicit confirmation;
- permission revocation and unlinking behavior;
- recovery after network or process interruption.

Git history, local WebSocket updates, and Task cloud sync are separate mechanisms. Sync must not assume a universal last-write-wins winner or silently overwrite local files. The full protocol is a later design/implementation phase; the initial local product must establish safe file operations and stable identity foundations without implementing the sync engine.

## Hosted API internal boundaries and shared packages

The hosted API starts as a modular monolith. Its domain modules are internal modules, not separate deployable services.

There are no pre-approved shared package names or empty package placeholders. Extract a package only when:
- at least two real consumers need the same implementation, or a stable contract merits an independent boundary;
- its responsibility and public API can be stated precisely;
- dependency direction is clear; and
- it contains real implementation and a concrete verification path.

Potential future candidates include document parsing/validation, workspace operations, domain schemas, sync contracts, and API client contracts. These are candidates, not a required package list.

## Implementation sequence

1. Define workspace configuration, file/document contracts, stable local IDs, discovery, and validation; implement useful CLI operations.
2. Implement the local application runtime and secure local HTTP/WebSocket boundary.
3. Build the local dashboard against the local application and shared workspace operations.
4. Integrate CLI and dashboard; verify updates in both directions, including external file edits.
5. Harden local file integrity, workspace boundaries, recovery, and offline behavior.
6. Specify cloud identity, API contracts, ownership, and authorization.
7. Implement the standalone NestJS API and hosted website.
8. Design and implement two-way multi-device synchronisation, then add CLI login/link/sync workflows.
9. Build the Flutter mobile client against the hosted API.
10. Add the TUI using the same workspace operations.

A directory's existence is not evidence that a capability is implemented.
