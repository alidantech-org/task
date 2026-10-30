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
    ├── site/            # Local dashboard and hosted website modes
    ├── mobile/          # Hosted mobile client
    └── tui/             # Interactive terminal interface
```

These are intended boundaries, not empty placeholder projects. Add each application when its implementation contracts are ready.

## Runtime responsibilities

- The CLI manages local workspaces and starts or manages the local runtime.
- The local runtime mediates safe workspace access and provides local HTTP/WebSocket interfaces for the dashboard and live updates.
- The site runs in local mode against the local runtime or cloud mode against the hosted API.
- The mobile app connects directly to the hosted API.
- The TUI is a keyboard-driven interface for people and reuses the same workspace operations and validation as the CLI.
- The standalone NestJS API owns hosted identity, authorization, persistence, and cloud operations.
- Cloud synchronization is separate from local WebSocket live updates.

## Shared packages

No shared package workspaces exist yet. Extract a package only when real code has a clear owner, stable public contract, and justified reuse or independent lifecycle. Do not create packages solely because a domain concept or API module has a name.

See [source layout and implementation boundaries](../.docs/architecture/source-layout.md), [platform architecture](../.docs/architecture/platform-architecture.md), and [Decision 0005](../tasks/decisions/0005-client-local-runtime-and-api-architecture.md).
