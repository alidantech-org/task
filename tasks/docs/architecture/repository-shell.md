---
id: DOC-ARCHITECTURE-REPOSITORY-SHELL
name: Repository Shell
type: documentation
tags:
  - engineering
---

# Repository shell and tooling

This document records the repository-level development foundation. It distinguishes project setup from implemented product capabilities.

## Repository structure

```text
task/
├── tasks/docs/                       # Engineering documentation
├── tasks/                       # Task-managed records and decisions
├── source/
│   ├── api/                     # NestJS hosted API
│   ├── apps/
│   │   ├── cli/                 # task / tk
│   │   ├── local/               # Local runtime + Next.js dashboard
│   │   ├── site/                # Hosted Next.js website
│   │   ├── mobile/              # Flutter/Dart cloud client
│   │   └── tui/                 # TypeScript terminal interface
│   └── packages/
│       ├── contracts/           # Shared TypeScript contracts
│       └── workspace/           # Shared local workspace primitives
├── package.json                # Root Bun workspace and commands
├── tsconfig.json
└── ...
```

## Tooling and workspace management

- Bun is the package manager/runtime for JavaScript and TypeScript projects.
- The root package.json is the single Bun workspace manager for source/api, source/apps/*, and source/packages/*.
- Every Bun-managed app/package retains its own package.json for dependencies, scripts, exports, and package identity.
- Root scripts orchestrate CLI, local runtime, local dashboard, hosted site, API, TUI, and typechecking.
- Next.js App Router is the framework for both browser apps, which remain separate applications and runtimes. They remain separate applications and runtimes.
- The hosted API uses NestJS as a modular monolith.
- Flutter/Dart is managed independently through source/apps/mobile/pubspec.yaml and Flutter tooling; it is not a Bun workspace and does not import TypeScript packages.
- Do not add generated SDK output at repository root.

## Shared packages

source/packages is the home for real shared code. The initial packages are:
- @task/contracts for transport-neutral TypeScript contracts.
- @task/workspace for shared local workspace primitives.

Each package must have real code, a clear owner, a stable public surface, and justified consumers. Do not add empty placeholders or a catch-all package. New package extraction follows actual reuse and contract stability.

## Application boundaries

- The CLI is scriptable and agent-friendly; ordinary local commands operate directly on workspace files and do not require the local server.
- The local app owns the local runtime and dashboard. It binds to loopback by default and mediates all browser access to workspace files.
- The hosted site is a separate cloud client and calls the hosted API directly.
- The hosted API is independent of the local runtime.
- Flutter mobile calls the hosted API directly.
- The TUI reuses workspace operations and validation rather than creating a second domain model.

The local runtime starter currently exposes only a health endpoint. Do not expose workspace data or mutations until workspace-scoped operations, origin/capability protections, and symlink-aware path checks are implemented.

## Task-managed Markdown

Task frontmatter applies only within the configured Task-managed workspace, not to every Markdown file in the repository.

- The default workspace directory is tasks/.
- Root task.yaml selects a different managed directory when configured, such as tasks/docs/ or .tasks/.
- Markdown files inside the selected workspace use the Task metadata contract.
- Ordinary repository Markdown outside the configured boundary (including README.md and AGENTS.md) remains ordinary Markdown.
- Unrelated project files must not be rewritten.

See [Markdown metadata and schema architecture](markdown-metadata-schema.md).

## Local-first and cloud direction

Local workspace files remain authoritative; Git is optional. Local operation does not require an account, network, or hosted API. Future Task Cloud synchronisation is two-way and supports multiple local replicas with independent device identities and progress. It requires stable IDs, revisions/cursors, idempotent retries, tombstones, conflict preservation, explicit initial reconciliation, revocation, and recovery. Git, local WebSocket updates, and cloud sync remain separate mechanisms.

See [source layout](source-layout.md), [platform architecture](platform-architecture.md), and Decisions [0006](../../decisions/0006-local-and-hosted-application-boundaries.md), [0007](../../decisions/0007-file-based-local-workspaces.md), [0008](../../decisions/0008-multi-device-two-way-sync.md), and [0009](../../decisions/0009-bun-monorepo-and-shared-packages.md).

## Development workflow

- Work on develop; keep main stable.
- Use tasks/docs/ for engineering documentation and the configured workspace for Task-managed work.
- Prefer small, reviewable commits.
- Do not commit dependency directories, build output, or generated artifacts unless explicitly required.
