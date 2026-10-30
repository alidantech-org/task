# Source layout

All application and package source code belongs under `source/`.

## Current implementation

- `apps/cli`: local command-line interface; `task` and `tk` share one entry point.

The CLI is currently the only scaffolded application. Its help/version behavior is the only implemented product capability in this source tree.

## Intended application layout

```text
source/
├── api/                 # Standalone NestJS hosted API
└── apps/
    ├── cli/             # Scriptable CLI for people and agents
    ├── local/           # Local runtime, HTTP/WS API and dashboard
    ├── site/            # Hosted website
    ├── mobile/          # Flutter cloud client
    └── tui/             # Interactive terminal interface
```

These are intended boundaries, not empty placeholder projects. Build the CLI and local application first. Add the hosted API, hosted website, mobile, and TUI when their implementation stages begin.

## Runtime responsibilities

- The CLI manages local workspaces, runs commands directly against shared workspace operations, and starts/manages the local application with `task run`.
- The local application owns the local dashboard, restricted HTTP API, WebSocket live updates, filesystem watching/reconciliation, and controlled local workspace access.
- CLI commands remain usable without the local application running.
- The hosted website at `task.alidantech.org` connects directly to the hosted API at `task-api.alidantech.org`.
- The hosted API is a standalone NestJS modular monolith.
- The mobile application is planned in Flutter and connects directly to the hosted API.
- The TUI is a future keyboard-driven interface that reuses workspace operations and validation.
- Cloud synchronisation is separate from local WebSocket live updates and must eventually support two-way changes across multiple local device replicas.

## Local workspace model

- Workspace records are stored in files; files are authoritative for local data.
- Git is optional. A workspace can be a normal directory or live inside a Git repository.
- Root `task.yaml` selects the managed workspace boundary; the default is `tasks/`.
- Task Markdown frontmatter rules apply only inside the configured managed boundary.
- Derived indexes/caches may be used when justified but cannot become a competing source of truth.
- Local-only workflows do not require an account, network, database server, or hosted API.

## Shared packages

No shared package workspaces exist yet. Extract a package only when real code has a clear owner, stable public contract, and justified reuse or independent lifecycle. Do not create packages solely because a domain concept or API module has a name.

See [source layout and implementation boundaries](../.docs/architecture/source-layout.md), [platform architecture](../.docs/architecture/platform-architecture.md), and decisions [0006](../tasks/decisions/0006-local-and-hosted-application-boundaries.md), [0007](../tasks/decisions/0007-file-based-local-workspaces.md), and [0008](../tasks/decisions/0008-multi-device-two-way-sync.md).
