# Source layout

All application and package source code belongs under source/.

## Current implementation

The repository contains starter projects for the agreed application boundaries:

- api: NestJS hosted API foundation with a health endpoint.
- apps/cli: polished, coloured scriptable CLI; task and tk share one entry point.
- apps/local: Next.js dashboard and a separate loopback-only local runtime.
- apps/site: separate Next.js hosted website foundation.
- apps/mobile: Flutter/Dart cloud client foundation.
- apps/tui: OpenTUI + React interactive terminal interface.
- packages/contracts: shared TypeScript contracts.
- packages/workspace: shared local workspace primitives.

These are project foundations, not completed product capabilities. Authentication, persistence, workspace discovery, local security, WebSocket updates, sync, and user workflows remain future implementation work.

## Intended and scaffolded layout

```text
source/
├── api/                    # NestJS hosted API
├── apps/
│   ├── cli/                # task / tk
│   ├── local/              # Local runtime and Next.js dashboard
│   ├── site/               # Hosted Next.js website
│   ├── mobile/             # Flutter cloud client
│   └── tui/                # OpenTUI + React terminal interface
└── packages/
    ├── contracts/          # Shared TypeScript contracts
    └── workspace/          # Shared local workspace operations
```

## Root Bun workspace

The repository root package.json is the single Bun workspace manager for source/api, source/apps/*, and source/packages/*. Each Bun application/package retains its own package.json to declare its identity, dependencies, scripts, and exports. Run installation and cross-project scripts from the repository root.

The root scripts include dev:cli, dev:local, dev:local:runtime, dev:local:web, dev:site, dev:api, dev:tui, and typecheck. The root Bun version is set to 1.3.14 or later for OpenTUI native runtime compatibility. The CLI uses picocolors and @clack/prompts; the TUI uses OpenTUI and React bindings; all web apps use Next.js.

Flutter is intentionally outside the Bun workspace. source/apps/mobile is managed through pubspec.yaml and Flutter tooling. It calls the hosted API directly and must not import TypeScript package source.

## Application boundaries

- The CLI runs local workspace operations directly and remains usable without the local server.
- The local application owns its local runtime, dashboard, restricted HTTP API, WebSocket updates, and filesystem reconciliation. The current server exposes only a health endpoint; it must not expose workspace data or mutations until origin/capability security and workspace path protections are implemented.
- The hosted website at task.alidantech.org is a separate Next.js cloud client and connects directly to task-api.alidantech.org.
- The hosted API is a standalone NestJS modular monolith.
- The Flutter mobile app connects directly to the hosted API.
- The TUI reuses shared workspace operations and validation; it must not create a second task model.

## Shared packages

source/packages is the home for real reusable code shared across applications. A package needs a clear owner, actual implementation, stable public contract, and justified consumers. It is not a dumping ground and must not contain empty placeholders.

Initial packages:
- @task/contracts: transport-neutral TypeScript contracts for Bun-managed applications.
- @task/workspace: local workspace primitives shared by local consumers. The current path containment helper is lexical only; filesystem operations must additionally defend against symlink escapes and enforce the configured managed boundary.

Flutter/Dart cannot import TypeScript packages. Equivalent contracts must be generated from a language-neutral source or maintained/generated for Dart.

## Local workspace model

- Workspace records are stored in files; files are authoritative for local data.
- Git is optional. A workspace can be a normal directory or live inside a Git repository.
- Root task.yaml selects the managed workspace boundary; the default is tasks/.
- Task Markdown frontmatter rules apply only inside the configured managed boundary.
- Derived indexes/caches may be used when justified but cannot become a competing source of truth.
- Local-only workflows do not require an account, network, database server, or hosted API.

See [source layout and implementation boundaries](../.docs/architecture/source-layout.md), [platform architecture](../.docs/architecture/platform-architecture.md), and decisions [0006](../tasks/decisions/0006-local-and-hosted-application-boundaries.md), [0007](../tasks/decisions/0007-file-based-local-workspaces.md), [0008](../tasks/decisions/0008-multi-device-two-way-sync.md), [0009](../tasks/decisions/0009-bun-monorepo-and-shared-packages.md), [0010](../tasks/decisions/0010-shared-local-workspace-engine.md), and [0011](../tasks/decisions/0011-application-experience-tooling.md).
