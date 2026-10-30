# Source layout

All application and package source code belongs under `source/`.

## Current implementation

- `apps/cli`: local command-line interface; `task` and `tk` share one entry point.

The CLI is currently the only scaffolded application. Its help/version behavior is the only implemented product capability in this source tree.

## Future product surfaces

The architecture documents a local dashboard, hosted web client, hosted modular API, and mobile client. They are not created as placeholder workspaces. TUI remains optional and deferred.

## Shared packages

No shared package workspaces exist yet. Extract a package only when real code has a clear owner, stable public contract, and justified reuse or independent lifecycle. Do not create packages solely because a domain concept or API module has a name.

See [source layout and implementation boundaries](../.docs/architecture/source-layout.md) for the rules and intended evolution.
