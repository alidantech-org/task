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

This installs the root development tools and links the CLI workspace.

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

## Workspace status

The only Bun workspace is the CLI under `source/apps/cli`. The root `typecheck` script checks the current workspace. Other product surfaces and shared packages are intentionally not scaffolded until their contracts and implementation boundaries are ready.
