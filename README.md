# Task

Task is a hybrid task and project management platform for individuals and organizations, built with Bun and TypeScript. It supports local repository work, optional cloud-connected workspaces, and cloud-native projects.

The intended interfaces are:

- **CLI** for developers and AI agents.
- **Local dashboard** for visual project and Kanban management.
- **Hosted web application** for personal and organizational work across projects.
- **Mobile application** for access to work across devices.
- **Hosted API** for identity, organizations, cloud workspaces, collaboration, and synchronization.
- **Terminal interface** for interactive terminal workflows.

All interfaces will use one shared domain model. Local-only workflows remain useful without an account or hosted service. Users may optionally connect repository workspaces to Task Cloud or create cloud-native workspaces without Git.

## Repository conventions

- `source/` contains application and package source code.
- `.docs/` contains engineering documentation about the Task software project by convention.
- The Task-managed workspace defaults to `tasks/`, but can be configured to use another directory such as `.docs/` or `.tasks/`.
- Only Markdown files inside the configured Task-managed workspace require Task YAML frontmatter.
- Root/common Markdown files outside that workspace, such as this README, do not require Task frontmatter.
- Root `TODO.md`, when introduced, is an overview/index rather than a second source of truth.
- No generated SDK directory is planned.

See [Repository documentation](.docs/README.md), [Task workspace conventions](tasks/README.md), the [install-once, use-in-any-project guide](.docs/guides/install-once-use-anywhere.md), [platform architecture](.docs/architecture/platform-architecture.md), and [Decision 0004](tasks/decisions/0004-hybrid-cloud-platform.md).

## CLI

The CLI is being developed under `source/apps/cli`. Both `task` and `tk` are intended to invoke the same executable.

The initial shell currently supports:

```sh
task --help
task --version
tk --help
```

## Development setup

Install [Bun](https://bun.sh), then from the repository root run:

```sh
bun install
bun run dev
```

Run the current CLI typecheck with:

```sh
bun run typecheck
```

See [development setup](.docs/development/setup.md) for details.

## Branch workflow

- `develop` is the integration branch. Day-to-day work happens here.
- `main` is the stable branch. Promote reviewed changes from `develop` when ready.

## Project status

The repository currently contains the initial documentation, development guidance, Bun workspace configuration, and a minimal CLI entry point. The hybrid local-first and cloud-native product direction is accepted and documented. The hosted API, identity and organization model, cloud persistence, synchronization protocol, hosted web/mobile clients, local dashboard, and production distribution are architectural direction only; they have not yet been implemented. Detailed schemas, authorization rules, and sync conflict policies remain to be designed.
