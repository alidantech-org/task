---
id: TASK-DEV-SETUP
name: Development setup
type: guide
---

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

## Markdown files

All Task-managed Markdown files, including documentation, require YAML frontmatter with the common `id`, `name`, and `type` fields. Add frontmatter when creating a document; the future `task validate` command will treat missing or invalid metadata as an error.

## Current scope

This setup is intentionally small. There is not yet a dashboard, `task run` command, validator, test runner, formatter/linter, shared core package, or persistence implementation. Add tooling when the corresponding architecture and workflow are agreed.
