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

## Typecheck

```sh
bun run typecheck
```

## Current scope

This setup is intentionally small. There is not yet a dashboard, test runner, formatter/linter, shared core package, or persistence implementation. Add tooling when the corresponding architecture and workflow are agreed.
