---
id: DOC-DEVELOPMENT-SETUP
name: Setup
type: documentation
tags:
  - engineering
---

# Development setup

## Requirements

- Bun 1.3.14 or later for the TypeScript workspace, API runtime, and OpenTUI.
- Node.js 20.9 or later for Next.js tooling.
- Git.
- Flutter SDK for mobile development and the complete validation pipeline.

## Install dependencies

From the repository root, install all Bun workspace dependencies and resolve the separate Flutter app's dependencies with one command:

    bun run setup

This resolves the root Bun workspace, including the CLI, local runtime/dashboard, hosted Next.js site, NestJS API, TUI, shared packages, and Biome, then runs Flutter `pub get` through the root bridge. It refreshes `bun.lock` and `source/apps/mobile/pubspec.lock` when manifests or SDK resolution require it. Flutter must already be installed and available on `PATH`; setup reports that prerequisite clearly.

Flutter remains outside the Bun workspace. To install checkout-only `taskcode-dev` and `tc-dev` commands in Bun's global executable directory, opt in during setup:

    bun run setup --link-cli

The global CLI link is optional; ordinary repository commands work without it.

## Run applications

Start the API, hosted site, local runtime, and local dashboard together:

    bun dev

The root supervisor prefixes service logs, keeps the processes attached to the terminal, stops peers if a process exits, and shuts everything down on Ctrl+C. Defaults are API `127.0.0.1:3000`, hosted site `127.0.0.1:5174`, local dashboard `127.0.0.1:5173`, and local runtime `127.0.0.1:4317`.

Run terminal tools separately: CLI commands are short-lived and the TUI needs its own interactive terminal.

    bun run dev:cli
    bun run dev:cli:watch
    bun run dev:local
    bun run dev:site
    bun run dev:api
    bun run dev:tui
    bun run dev:mobile

The CLI and its `task`/`tc` aliases operate on workspace files directly through `@task/workspace`:

    bun run dev:cli -- --help
    bun run dev:cli -- info
    bun run dev:cli -- group create --title "Workspace foundation"
    bun run dev:cli -- create --group <group-id> --title "Add a task"
    bun run dev:cli -- list --json
    bun run dev:cli -- validate

To make `taskcode-dev` and `tc-dev` available globally while pointing at this live checkout:

    bun run cli:link

Run `bun run cli:unlink` to remove those development commands. Make sure `$(bun pm bin -g)` is on `PATH`. The commands invoke the CLI source in this checkout and leave any installed `taskcode`, `task`, and `tc` commands untouched. For example, use `taskcode-dev --version` for the checkout version and `taskcode --version` for the installed release. For a persistent live view during development, run `bun run dev:cli:watch -- info` (or replace `info` with the command you are working on); it reruns the selected CLI command when source changes.

Bare `task` opens a terminal menu when attached to a TTY; in non-interactive shells it prints the overview and exits. `task --quiet` suppresses the bare overview. `task --json` returns machine-readable overview data. Workspace selection uses `--workspace`, then `TASK_WORKSPACE_ROOT`, then upward discovery of the nearest `task.yaml` or `tasks/` directory. `task --help` lists supported commands and filters. Non-interactive creation requires explicit arguments; JSON success output is written to stdout and errors to stderr. Human output uses compact width-aware task tables and grouped validation diagnostics; `--verbose` adds paths and metadata. `--plain` and `--no-color` disable color. See [CLI setup and behavior](../../../source/apps/cli/README.md) and [workspace discovery](../architecture/workspace-discovery.md).

To set up a new local project, run `task init` (or `task init --workspace .tasks`) from its root. Then use `task -f` or `task tui` to open the read-only full-screen browser; it shares the CLI's resolved workspace. See [TUI setup and keys](../../../source/apps/tui/README.md).

After initializing a project, run `task run` to start the local dashboard and its Bun workspace runtime. The CLI starts the packaged production Next.js build, waits for runtime and dashboard readiness, opens the loopback URL in the browser, and keeps both services attached to the terminal. Ctrl+C shuts them down. Use `task run --no-open` when launching from automation or a remote terminal. The dashboard uses port 5173 because the runtime’s browser mutation boundary is restricted to that same origin; close an existing dashboard before starting another.

The CLI release package is prepared with `bun run cli:package`. This builds the production dashboard from an isolated temporary checkout and bundles the local runtime alongside the CLI’s Task workspace dependencies, preserving the developer's `.next` directory. Before publishing, run `bun run cli:publish:check`; it runs the repository validation gate, prepares release assets, and rechecks CLI, workspace, and TUI tests plus a temporary global installation. Publish shared packages before the CLI in this order: `@task/contracts`, `@task/ui`, `@task/workspace`, `@task/tui`, then `taskcode`. Install the published CLI using `bun add --global taskcode`. Publication itself is a separate maintainer action and is not performed by the check command.

The local command starts the loopback-only local runtime and the local Next.js dashboard together. They can also be started separately:

    bun run dev:local:runtime
    bun run dev:local:web

The hosted website is a separate Next.js application. The hosted API is a separate NestJS modular monolith. Flutter is invoked through a small root Bun bridge so its native toolchain remains independent.

## Formatting and linting

Apply Biome formatting:

    bun run format

Check formatting without modifying files:

    bun run format:check

Run Biome lint/security rules:

    bun run lint

Apply safe lint fixes:

    bun run lint:fix

Biome is configured once at the repository root. It covers JavaScript, TypeScript, JSX, TSX and JSON/JSONC source/config files while excluding generated output and dependencies.

## Tests and typechecks

    bun run typecheck
    bun run test
    bun run test:watch
    bun run test:coverage

The Bun test command runs tests from every Bun workspace. Flutter tests are separate:

    bun run mobile:analyze
    bun run mobile:test

## Security and complete validation

Audit dependency advisories:

    bun run audit

Run lint plus the automated test suite and dependency audit:

    bun run security

Run the full root quality gate:

    bun run validate

The validate command runs, in order:
1. Biome formatting verification.
2. Dependency vulnerability audit.
3. Biome lint/security checks.
4. TypeScript checks for every Bun workspace.
5. Bun tests for every Bun workspace.
6. NestJS API and both Next.js production builds.
7. Flutter static analysis and Flutter tests.

The full validation requires a refreshed bun.lock, installed Bun dependencies, Flutter SDK/dependencies, and network access for the dependency audit. If Flutter is not installed, use the individual Bun checks while arranging the mobile toolchain; the full validation intentionally reports that missing requirement rather than silently skipping an application.

## Mobile application

Root scripts delegate to Flutter from source/apps/mobile:

    bun run mobile:pub:get
    bun run dev:mobile
    bun run mobile:analyze
    bun run mobile:test

Flutter/Dart does not import TypeScript package source. Cross-language contracts must be generated from a language-neutral schema or maintained/generated for Dart.

## Current implementation scope

The CLI and `@task/workspace` provide workspace discovery, task/document queries, metadata/body search, validation, task/group creation and updates, editor handoff, and group archive/restore. `task project inspect` performs static repository inspection; `task setup` reviews and applies selected Task documents, rules, and native agent guidance adapters. The inspector never executes project code. The TUI provides read-only Rules and Agent Profile browsing; launching and orchestrating agents remain out of scope. The local runtime still exposes only a loopback health endpoint; browser access to workspace content, runtime authorization and mutations, WebSocket updates, API persistence/authentication, cloud sync, and broader product workflows remain future work.
