# Development setup

## Requirements

- [Bun](https://bun.sh) with support for workspaces and TypeScript execution.
- Git.

The repository does not pin a Bun version yet. We can set a minimum version after validating the toolchain in supported development environments.

## Install

From the repository root:

```sh
bun install
```

This installs the root development tools and links workspace packages.

## Run the CLI

```sh
bun run dev
```

The initial CLI entry point supports `--help` and `--version`. Both `task` and `tk` package binaries point to the same source entry point; local executable linking will be refined with the CLI packaging workflow.

The planned local web application will be started with `task run`; for example, `task run -p 3004` selects port 3004. That command is a product direction, not implemented by the current CLI shell.

## Typecheck

```sh
bun run typecheck
```

## Task-managed Markdown files

YAML frontmatter is required only for Markdown files inside the configured Task-managed workspace. The workspace defaults to `tasks/`; a repository can select another directory in `task.yaml`. Ordinary repository Markdown outside that directory, including this engineering documentation, does not need Task frontmatter.

The common metadata fields are `id`, `name`, and `type`. Add frontmatter when creating Markdown files inside the managed workspace; the future `task validate` command will treat missing or invalid metadata there as an error.

## Current scope

This setup is intentionally small. There is not yet a dashboard, `task run` command, validator, test runner, formatter/linter, shared core package, or persistence implementation. Add tooling when the corresponding architecture and workflow are agreed.

## Workspace package status

The repository now includes Bun workspace shells for the CLI, hosted web, API, mobile, and TUI applications, plus the shared packages documented in [source layout](../architecture/source-layout.md). Run `bun install` at the repository root to link the workspaces. `bun run typecheck` invokes each workspace's TypeScript check. This is a structural check only; it does not build or run placeholder applications. The CLI remains the only application with functional commands. Frameworks, API persistence, domain contracts, and synchronization are not implemented.
