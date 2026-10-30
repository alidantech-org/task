# Source layout

All application and package source code belongs under source/.

## Application foundations

- api: NestJS hosted API with a health endpoint and controller smoke test.
- apps/cli: coloured, scriptable CLI; task and tk share one entry point.
- apps/local: Next.js dashboard plus a separate loopback-only local runtime. The dashboard checks runtime health server-side.
- apps/site: hosted Next.js website starter; it checks the configured Task API health endpoint server-side.
- apps/mobile: Flutter/Dart application with a widget smoke test.
- apps/tui: OpenTUI + React interactive terminal navigation shell.
- packages/contracts: shared TypeScript contracts and a runtime health-payload guard.
- packages/workspace: lexical and symlink-aware workspace path preflight helpers with safety tests.

These are starter foundations, not completed product capabilities. Workspace discovery and CRUD, safe file mutation primitives, local authorization, WebSocket reconciliation, API authentication/persistence, cloud sync and complete user workflows remain implementation work.

## Root Bun workspace

The repository root package.json manages source/api, source/apps/cli, source/apps/local, source/apps/site, source/apps/tui, and source/packages/*. Each Bun application/package retains its own package.json for dependencies, scripts and exports.

The root exposes development commands for the CLI, local app, hosted site, API, TUI and mobile app. Flutter remains outside Bun workspaces; root scripts delegate to its native toolchain.

## Quality commands

From the repository root:

    bun install
    bun run format
    bun run validate

The single validate command checks Biome formatting, dependency advisories, lint/security rules, TypeScript across all Bun workspaces and root scripts, Bun tests, API and Next.js production builds, and Flutter analysis/tests.

Flutter dependencies must be resolved once before validation:

    bun run mobile:pub:get

Useful individual commands include format:check, lint, typecheck, test, audit, security, build, mobile:analyze and mobile:test. See [development setup](../.docs/development/setup.md).

## Application boundaries

- The CLI performs local workspace operations directly and remains usable without the local server.
- The local application owns its local runtime, Next.js dashboard, restricted HTTP API, WebSocket updates and filesystem reconciliation. The current runtime exposes only GET /health.
- The hosted website at task.alidantech.org is a separate Next.js cloud client and connects to task-api.alidantech.org.
- The hosted API is a standalone NestJS modular monolith.
- The Flutter mobile app connects directly to the hosted API.
- The TUI reuses shared workspace operations and validation; it must not create a second task model.

## Shared packages

source/packages is the home for real reusable code shared across applications. A package needs a clear owner, actual implementation, stable public contract and justified consumers. It is not a dumping ground and must not contain empty placeholders.

Initial packages:
- @task/contracts: transport-neutral TypeScript contracts for Bun-managed applications.
- @task/workspace: local workspace path primitives shared by local consumers. Symlink-aware path preflight is not a substitute for race-safe file operations.

Flutter/Dart cannot import TypeScript packages. Equivalent contracts must be generated from a language-neutral source or maintained/generated for Dart.

## Local workspace model

- Workspace records are stored in files; files are authoritative for local data.
- Git is optional. A workspace can be a normal directory or live inside a Git repository.
- Root task.yaml selects the managed workspace boundary; the default is tasks/.
- Task Markdown frontmatter rules apply only inside the configured managed boundary.
- Derived indexes/caches may be used when justified but cannot become a competing source of truth.
- Local-only workflows do not require an account, network, database server, or hosted API.

See [source layout and implementation boundaries](../.docs/architecture/source-layout.md), [platform architecture](../.docs/architecture/platform-architecture.md), and decisions 0006–0011.
