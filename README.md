# Task

Task is a repository-native task and project management system built with Bun and TypeScript.

The intended interfaces are:

- **CLI** for developers and AI agents.
- **Local dashboard** for visual project and Kanban management.
- **Terminal interface** for interactive terminal workflows.

All interfaces will operate on one shared workspace and domain model. Markdown and Git are the foundation; a hosted service or external database should not be required.

## Repository conventions

- `source/` contains application and package source code.
- `.docs/` contains engineering documentation about the Task software project by convention.
- The Task-managed workspace defaults to `tasks/`, but can be configured to use another directory such as `.docs/` or `.tasks/`.
- Only Markdown files inside the configured Task-managed workspace require Task YAML frontmatter.
- Root/common Markdown files outside that workspace, such as this README, do not require Task frontmatter.
- Root `TODO.md`, when introduced, is an overview/index rather than a second source of truth.
- No generated SDK directory is planned.

See [Repository documentation](.docs/README.md), [Task workspace conventions](tasks/README.md), and the [install-once, use-in-any-project guide](.docs/guides/install-once-use-anywhere.md).

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

The repository currently contains the initial documentation, development guidance, Bun workspace configuration, and a minimal CLI entry point. The Task-managed workspace frontmatter contract is accepted; complete type-specific schemas, workspace configuration, persistence, lifecycle, command architecture, shared core, and dashboard remain to be designed.
