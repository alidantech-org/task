# taskcode

Manage tasks and project documents from your terminal. The package provides `taskcode`, `task`, and `tc` commands for the same local workspace.

## Requirements

- Bun 1.3.14 or later to run the CLI.
- Node.js 20.9 or later for `task run` (the local dashboard).

## Install and start

```sh
npm install --global taskcode
mkdir my-project && cd my-project
task init
task
```

`task init` creates a workspace in the current project. `task` opens the interactive menu for creating and managing tasks.

## Common commands

```sh
task list
task group list
task search "release"
task docs list
task validate
```

Open the full-screen terminal browser with `task -f`. Start the local dashboard with `task run`; use `task run --no-open` in scripts or remote terminals. Press Ctrl+C to stop it.

## Automation

Use `--json` for machine-readable output:

```sh
task --json
task list --json
task validate --json
```

Choose a workspace explicitly with `--workspace`:

```sh
task --workspace ./tasks list
```

Run `task --help` to see all commands and options.
