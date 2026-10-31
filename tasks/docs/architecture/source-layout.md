---
id: DOC-ARCHITECTURE-SOURCE-LAYOUT
name: Source Layout
type: documentation
tags:
  - engineering
---

# Source layout and implementation boundaries

## Purpose

This document maps the accepted Task architecture to source-code ownership and distinguishes starter projects from completed capabilities. All application and package source code belongs under source/. Do not add a generated root sdk/ directory.

Architecture decisions:
- [0006 — Separate local and hosted application boundaries](../../decisions/0006-local-and-hosted-application-boundaries.md)
- [0007 — File-based local workspaces and optional Git](../../decisions/0007-file-based-local-workspaces.md)
- [0008 — Two-way multi-device synchronization](../../decisions/0008-multi-device-two-way-sync.md)
- [0009 — Bun monorepo, application scaffolds, and shared packages](../../decisions/0009-bun-monorepo-and-shared-packages.md)
- [0010 — Shared local workspace engine for CLI and dashboard](../../decisions/0010-shared-local-workspace-engine.md)
- [0011 — Next.js web applications, advanced TUI, and polished CLI](../../decisions/0011-application-experience-tooling.md)
- [Shared local workspace engine and CLI/dashboard collaboration](local-workspace-engine.md)

## Source tree

    source/
    ├── api/                     # NestJS hosted API
    ├── apps/
    │   ├── cli/                 # Scriptable CLI: task / tc
    │   ├── local/               # Local runtime + Next.js dashboard
    │   ├── site/                # Hosted Next.js website
    │   ├── mobile/              # Flutter/Dart cloud client
    │   └── tui/                 # OpenTUI + React terminal application
    └── packages/
        ├── contracts/           # Shared TypeScript contracts
        ├── ui/                  # Shared browser design tokens and primitives
        └── workspace/           # Shared local workspace index and path primitives

Root-level scripts/ contains small Bun bridges for native toolchains such as Flutter; it is not an application source directory.

## TypeScript import conventions

TypeScript source does not use relative imports. Use `@/…` inside the local and hosted Next.js applications and `#/…` inside the API, CLI, TUI, and shared packages. Import across project boundaries through the owning package name (for example, `@task/contracts`). The root import check enforces this rule.

## Root Bun workspace and quality gates

The repository root package.json manages source/api, source/apps/cli, source/apps/local, source/apps/site, source/apps/tui, and source/packages/*. Each Bun-managed project has its own package.json and independently runnable scripts. Flutter is intentionally excluded from Bun workspaces and is managed by pubspec.yaml and Flutter tooling.

The root provides commands for every application and a single quality gate:

- dev:cli, dev:local, dev:site, dev:api, dev:tui, dev:mobile
- format / format:check / lint / lint:fix
- typecheck / test / test:watch / test:coverage
- audit / security / build / validate

bun run validate checks formatting, dependency advisories, lint/security rules, all Bun workspace typechecks and tests, API and Next.js builds, and Flutter analysis/tests. It requires Bun dependencies and the lockfile to be current, Flutter SDK/dependencies, and network access for the advisory audit. See [development setup](../development/setup.md).

Biome is configured once at the root in biome.json. It formats and lints JavaScript/TypeScript/JSX/TSX and JSON/JSONC configuration files, and organizes imports. Generated output and dependencies are excluded.

OpenTUI requires Bun 1.3.14 or later. The root packageManager field pins Bun 1.3.14. Flutter is managed independently through source/apps/mobile/pubspec.yaml and root scripts delegate to its native CLI without treating Dart as a Bun workspace.

## Application responsibilities

| Application | Responsibility | Runtime/deployment |
| --- | --- | --- |
| api/ | Identity, organisations, workspaces, records, authorization, cloud persistence and future sync endpoints | Standalone NestJS modular monolith at task-api.alidantech.org |
| apps/cli/ | Polished, scriptable task/tc commands, validation, agent workflows and later cloud commands | Local executable; ordinary local commands need no server, account or network |
| apps/local/ | Local dashboard, local HTTP API, WebSocket live updates, filesystem watching/reconciliation and controlled workspace access | Local runtime binds to loopback; dashboard is a separate Next.js process during development |
| apps/site/ | Hosted account, personal workspace, organisation, project and collaboration experience | Next.js App Router; hosted at task.alidantech.org; calls hosted API directly |
| apps/mobile/ | Focused mobile workflows for authorised cloud workspaces | Flutter app connecting directly to hosted API |
| apps/tui/ | Advanced keyboard-driven terminal workspace with navigation, focus, interactive views and future task operations | OpenTUI + React, running on Bun |

All web applications use Next.js App Router. The local dashboard and hosted website remain distinct applications with separate entry points, runtime responsibilities, state, routing, security boundaries, and deployment. The local HTTP runtime remains a separate process from the Next.js dashboard; it owns controlled local filesystem access and must not be replaced by browser-side filesystem access.

## Framework and experience standards

- **Web:** Next.js App Router for every website and browser application. Do not introduce Vite as the application framework for new web surfaces.
- **TUI:** OpenTUI with React bindings. Use its native renderer, responsive terminal layout, keyboard events, focus/selection primitives and component model. The TUI reuses shared workspace operations and must not create another domain model.
- **CLI:** a purpose-built, coloured and carefully formatted command experience. Use picocolors for terminal-aware colour and @clack/prompts for accessible interactive prompts, selections, confirmations and progress. Preserve task and tc, machine-readable output, predictable exit codes, and non-interactive operation for scripts and agents.
- **Runtime:** Bun manages the TypeScript workspace. OpenTUI requires Bun 1.3.14 or later. Flutter remains on its independent Dart toolchain.

## Current implementation status

- The CLI has task/tc aliases, workspace discovery, overview/list/show/search, task and group creation/update, editor handoff, completion storage under `todo/_completed/`, explicit archive/restore under `todo/_archived/`, document commands, validation, index diagnostics, static project inspection, reviewed setup plans, JSON output, stable error codes, and TTY-only prompts. It calls `@task/workspace` directly and does not require the local runtime. Project setup is static, does not execute repository code, and does not launch agents; it should ask before recommending or applying Git ignore choices for completed/archive history.
- The NestJS API has a bootstrap, health endpoint and a direct controller smoke test; it has no authentication, domain persistence or workspace modules yet.
- The local application has a Next.js dashboard with overview, task list/board/calendar, document browsing, detail panels, prompt generation, global full-text search, and workspace diagnostics. Its loopback runtime exposes capability-protected read/query/validation/refresh and task create/update routes through a same-origin Next.js proxy. Writes use shared operations with hash conflicts, symlink rejection, and atomic file replacement; they recheck directory and file identity before replacement but do not use kernel-enforced directory handles against a hostile concurrent filesystem actor. Trusted project switching, Markdown source editing, and WebSocket updates are not implemented.
- The hosted site has a separate Next.js App Router starter and a render smoke test; authentication and API-backed workflows are not implemented.
- The Flutter project has a minimal Material application and widget smoke test, with Flutter analyze/test wired into root scripts.
- The TUI has an OpenTUI/React interactive navigation shell with task, group, document, Rules, and Agent Profile browsing. Reads and previews use `@task/workspace`; it remains read-only.
- @task/contracts exports initial transport-neutral interfaces and a runtime health-payload guard.
- @task/workspace exports workspace resolution, shared Markdown indexing and body reads, task/document queries and search, metadata/reference/link/group validation, and task/group/document writes. Writes use exclusive creation, temporary replacement, hash conflict checks, and path checks; they are not claimed to be race-safe against hostile concurrent filesystem changes.

A scaffold is not evidence that its product capabilities are implemented.

## Shared packages

source/packages is the home for reusable code shared across applications. Extract or add a package only when it has a clear responsibility, real implementation, and actual consumers or a stable contract. Do not create empty packages or use this directory as a catch-all.

Initial packages:
- @task/contracts: transport-neutral TypeScript contracts for Bun-managed applications.
- @task/ui: shared Tailwind design tokens and React primitives for local and hosted Next.js apps. It does not own app routes, state, or data adapters.
- @task/workspace: workspace configuration/discovery, in-memory Markdown summaries and reconciliation, on-demand body reads, validation, queries/search, and local task/group operations shared by consumers.

TypeScript packages are not directly consumable by Flutter/Dart. The mobile client must use generated or separately maintained Dart contracts from a language-neutral schema or API definition.

The hosted API's conceptual modules remain internal modules of one NestJS application, not separate deployable services by default.

## CLI and shared workspace operations

The CLI is the primary scriptable interface for people and AI agents. It must work without the local application running. Commands invoke workspace operations directly rather than routing every command through HTTP. Human-facing output should be polished and coloured; JSON output and exit codes remain stable for automation.

The local application is intended to expose approved capabilities to the browser through its restricted local HTTP API. CLI and local application must not implement competing task/document rules. `@task/workspace` supplies the local CLI's shared task/document operations; browser access remains gated on origin/capability authorization and safe operation-boundary filesystem protections.

## Local runtime security

The browser never receives arbitrary filesystem access. Bind to loopback by default, validate browser origins, protect sensitive operations with a per-runtime capability/token or equivalent, and restrict operations to the selected workspace. Do not expose arbitrary paths, shell execution, credentials, or unrestricted filesystem operations.

The current runtime exposes only a read-only health endpoint and binds to 127.0.0.1. Before it exposes workspace data or mutations, implement workspace-scoped operations, symlink-safe file operations (including race protection), origin protection, and authorization. WebSocket updates are for local dashboard live updates, not cloud sync.

## Local files and Git

Local workspace records are stored in files. Files are authoritative for local workspace content. Git is optional and independent of Task Cloud sync.

Root task.yaml configures the workspace and managed content boundary. The default managed folder is tasks/; a workspace may configure .tasks/ or tasks/docs/. Task Markdown frontmatter rules apply only inside that configured boundary. Ordinary Markdown elsewhere remains ordinary Markdown, and unrelated project files must not be rewritten.

## Future two-way, multi-device synchronization

Task Cloud must eventually support two-way changes between a cloud workspace and multiple local replicas. Each replica has its own device/client identity and sync progress. The protocol must provide stable IDs, revisions/cursors, idempotent retries, tombstones, conflict preservation, explicit initial reconciliation, permission revocation, and recovery. Never silently overwrite work or assume universal last-write-wins.

Git history, local WebSocket updates, and Task cloud sync are separate mechanisms. The sync engine is a later implementation phase.

## Implementation sequence

1. Define workspace configuration, file/document contracts, stable local IDs, discovery, validation, and useful CLI operations.
2. Implement safe shared workspace operations used directly by CLI and local runtime.
3. Implement local runtime security, HTTP/WebSocket contracts, filesystem watching/reconciliation, and CLI-managed lifecycle.
4. Build the local dashboard against the local runtime and integrate bidirectional updates.
5. Harden file integrity, recovery, and offline behavior.
6. Define cloud identity, ownership, authorization, persistence, and API contracts.
7. Implement the hosted NestJS API and hosted website using Next.js.
8. Design and implement two-way multi-device sync.
9. Build the Flutter mobile client against stable API contracts.
10. Expand the OpenTUI terminal application using established workspace operations.

A directory's existence is not evidence that a capability is implemented.
