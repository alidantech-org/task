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
    bun run dev:local
    bun run dev:site
    bun run dev:api
    bun run dev:tui
    bun run dev:mobile

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

These are starter foundations, not completed product capabilities. The local runtime exposes only a loopback health endpoint; the Next.js apps render starter screens; the CLI provides help, version, JSON metadata and a Bun environment check; the TUI has interactive keyboard navigation; and `@task/workspace` provides a read-only in-memory Markdown summary index with reconciliation and optional watching. Set `TASK_WORKSPACE_ROOT` to an already resolved workspace directory for the CLI doctor, TUI overview, or local runtime index. Workspace commands/CRUD, browser access to indexed content, safe mutations, authenticated local HTTP operations, WebSocket updates, API persistence/authentication, cloud sync, and complete user workflows remain future implementation work.
