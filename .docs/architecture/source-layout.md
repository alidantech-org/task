# Source layout and implementation boundaries

## Purpose

This document maps the accepted Task architecture to source-code ownership and distinguishes starter projects from completed capabilities. All application and package source code belongs under source/. Do not add a generated root sdk/ directory.

Architecture decisions:
- [0006 — Separate local and hosted application boundaries](../../tasks/decisions/0006-local-and-hosted-application-boundaries.md)
- [0007 — File-based local workspaces and optional Git](../../tasks/decisions/0007-file-based-local-workspaces.md)
- [0008 — Two-way multi-device synchronization](../../tasks/decisions/0008-multi-device-two-way-sync.md)
- [0009 — Bun monorepo, application scaffolds, and shared packages](../../tasks/decisions/0009-bun-monorepo-and-shared-packages.md)
- [0010 — Shared local workspace engine for CLI and dashboard](../../tasks/decisions/0010-shared-local-workspace-engine.md)
- [Shared local workspace engine and CLI/dashboard collaboration](local-workspace-engine.md)

## Source tree

```text
source/
├── api/                     # NestJS hosted API
├── apps/
│   ├── cli/                 # Scriptable CLI: task / tk
│   ├── local/               # Local runtime and React + Vite dashboard
│   ├── site/                # Hosted React + Vite website
│   ├── mobile/              # Flutter/Dart cloud client
│   └── tui/                 # TypeScript terminal interface
└── packages/
    ├── contracts/           # Shared TypeScript contracts
    └── workspace/           # Shared local workspace primitives
```

## Root Bun workspace

The root package.json manages the Bun workspaces:
- source/api
- source/apps/*
- source/packages/*

Each Bun-managed project keeps its own package.json for its package name, dependencies, scripts, and exports. The root manifest provides shared development dependencies and cross-project commands. Run Bun installation and root scripts from the repository root.

The root commands include dev:cli, dev:local, dev:local:web, dev:site, dev:api, dev:tui, and typecheck. Flutter is intentionally excluded from Bun workspaces and is managed independently through source/apps/mobile/pubspec.yaml and Flutter tooling.

## Application responsibilities

| Application | Responsibility | Runtime/deployment |
| --- | --- | --- |
| api/ | Identity, organisations, workspaces, records, authorization, cloud persistence and future sync endpoints | Standalone NestJS modular monolith at task-api.alidantech.org |
| apps/cli/ | Workspace discovery, task/document commands, validation, agent workflows and later cloud commands | Local executable; ordinary local commands need no server, account or network |
| apps/local/ | Local dashboard, local HTTP API, WebSocket live updates, filesystem watching/reconciliation and controlled workspace access | Local runtime binds to loopback; React dashboard served separately during development |
| apps/site/ | Hosted account, personal workspace, organisation, project and collaboration experience | React + Vite; hosted at task.alidantech.org; calls hosted API directly |
| apps/mobile/ | Focused mobile workflows for authorised cloud workspaces | Flutter app connecting directly to hosted API |
| apps/tui/ | Keyboard-driven terminal interface for people | Bun-managed TypeScript client reusing workspace operations |
 
The local application and hosted website use React + Vite + TypeScript, but remain distinct applications with separate entry points, runtime responsibilities, state, routing, and deployment. Sharing a frontend toolchain does not merge their product boundaries.

## Current scaffold status

- The CLI retains its initial task/tk help and version entry point.
- The NestJS API has a bootstrap, application module, and health endpoint only.
- The local application has a React/Vite dashboard starter and a separate loopback-only HTTP server exposing only /health. It is not yet connected to workspace files, CLI lifecycle, or WebSocket updates.
- The hosted site has a separate React/Vite starter and no authentication or API-backed workflows yet.
- The Flutter project has a minimal Material application entry point.
- The TUI has a minimal TypeScript entry point.
- @task/contracts exports initial shared TypeScript interfaces.
- @task/workspace exports a lexical workspace path-containment helper. This does not by itself prevent symlink escapes; filesystem consumers must add realpath-aware protections and managed-boundary validation.

A scaffold is not evidence that its product capabilities are implemented.

## Shared packages

source/packages is the home for reusable code shared across applications. Extract or add a package only when it has a clear responsibility, real implementation, and actual consumers or a stable contract. Do not create empty packages or use this directory as a catch-all.

Initial packages:
- @task/contracts: transport-neutral TypeScript contracts for Bun-managed applications.
- @task/workspace: local workspace primitives shared by local consumers.

TypeScript packages are not directly consumable by Flutter/Dart. The mobile client must use generated or separately maintained Dart contracts from a language-neutral schema or API definition.

The hosted API's conceptual modules remain internal modules of one NestJS application, not separate deployable services by default.

## CLI and shared workspace operations

The CLI is the primary scriptable interface for people and AI agents. It must work without the local application running. Commands invoke workspace operations directly rather than routing every command through HTTP.

The local application exposes those same capabilities to the browser through its restricted local HTTP API. CLI and local application must not implement competing task/document rules. The workspace package is the intended home for genuinely shared local operations as those operations are implemented.

## Local runtime security

The browser never receives arbitrary filesystem access. Bind to loopback by default, validate browser origins, protect sensitive operations with a per-runtime capability/token or equivalent, and restrict operations to the selected workspace. Do not expose arbitrary paths, shell execution, credentials, or unrestricted filesystem operations.

Before the local API exposes workspace data or mutations, implement workspace-scoped operations, symlink-aware path protections, origin protection, and authorization. WebSocket updates are for local dashboard live updates, not cloud sync.

## Local files and Git

Local workspace records are stored in files. Files are authoritative for local workspace content. Git is optional and independent of Task sync.

Root task.yaml configures the workspace and managed content boundary. The default managed folder is tasks/; a workspace may configure .tasks/ or .docs/. Task frontmatter rules apply only inside that configured boundary. Ordinary Markdown elsewhere remains ordinary Markdown, and unrelated project files must not be rewritten.

## Future two-way, multi-device synchronization

Task Cloud must eventually support two-way synchronisation between one cloud workspace and multiple local replicas. Each replica has its own device/client identity and sync progress. The protocol must provide stable IDs, revisions/cursors, idempotent retries, tombstones, conflict preservation, explicit initial reconciliation, permission revocation, and recovery. Never silently overwrite work or assume universal last-write-wins.

Git history, local WebSocket updates, and Task cloud sync are separate mechanisms. The sync engine is a later implementation phase.

## Implementation sequence

1. Define workspace configuration, file/document contracts, stable local IDs, discovery, validation, and useful CLI operations.
2. Implement safe shared workspace operations used directly by CLI and local runtime.
3. Implement local runtime security, HTTP/WebSocket contracts, filesystem watching/reconciliation, and CLI-managed lifecycle.
4. Build the local dashboard against the local runtime and integrate bidirectional updates.
5. Harden file integrity, recovery, and offline behavior.
6. Define cloud identity, ownership, authorization, persistence, and API contracts.
7. Implement the hosted NestJS API and hosted website.
8. Design and implement two-way multi-device sync.
9. Build the Flutter mobile client against stable API contracts.
10. Expand the TUI using established workspace operations.

A directory's existence is not evidence that a capability is implemented.
