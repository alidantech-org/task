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

From the repository root:

    bun install

This resolves the root Bun workspace, including the CLI, local runtime/dashboard, hosted Next.js site, NestJS API, TUI, shared packages, and Biome. It also refreshes bun.lock when workspace manifests change. Commit the resulting lockfile so frozen installs use the same dependency graph.

Flutter remains outside the Bun workspace. Before the first mobile build, analysis, or test:

    bun run mobile:pub:get

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

The CLI and its `task`/`tk` aliases operate on workspace files directly through `@task/workspace`:

    bun run dev:cli -- --help
    bun run dev:cli -- info
    bun run dev:cli -- group create --title "Workspace foundation"
    bun run dev:cli -- create --group <group-id> --title "Add a task"
    bun run dev:cli -- list --json
    bun run dev:cli -- validate

To make `task` and `tk` available globally while pointing at this live checkout:

    bun run cli:link

Run `bun run cli:unlink` to remove those global links. Make sure `$(bun pm bin -g)` is on `PATH`. For a persistent live view during development, run `bun run dev:cli:watch -- info` (or replace `info` with the command you are working on); it reruns the selected CLI command when CLI or workspace source changes. Global commands also load the linked checkout each time, so ordinary `task`/`tk` invocations immediately use saved edits without keeping the watcher open.

Bare `task` opens a terminal menu when attached to a TTY; in non-interactive shells it prints the overview and exits. `task --json` returns machine-readable overview data. Workspace selection uses `--workspace`, then `TASK_WORKSPACE_ROOT`, then upward discovery of the nearest `task.yaml` or `tasks/` directory. `task --help` lists supported commands and filters. Non-interactive creation requires explicit arguments; JSON success output is written to stdout and diagnostics to stderr. See [CLI setup and behavior](../../../source/apps/cli/README.md) and [workspace discovery](../architecture/workspace-discovery.md).

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

The CLI and `@task/workspace` provide workspace discovery, task/document queries, metadata/body search, validation, task/group creation and updates, editor handoff, and group archive/restore. The local runtime still exposes only a loopback health endpoint; the Next.js apps render service-status shells; the TUI has interactive keyboard navigation but does not yet expose the CLI task workflows. Browser access to workspace content, runtime authorization and mutations, WebSocket updates, API persistence/authentication, cloud sync, and broader product workflows remain future work.
