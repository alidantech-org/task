# Development setup

## Requirements

- Bun 1.3.14 or later for the TypeScript workspace and OpenTUI runtime.
- Git.
- Flutter SDK for work on the mobile application.

## Install

From the repository root:

    bun install

The root Bun workspace installs and links the CLI, local runtime/dashboard, hosted site, API, TUI, and shared TypeScript packages. Flutter remains outside Bun workspaces and is managed with Flutter tooling.

## Run the applications

Scriptable CLI:

    bun run dev:cli

Local runtime and Next.js dashboard together:

    bun run dev:local

The processes can also be started separately:

    bun run dev:local:runtime
    bun run dev:local:web

Hosted Next.js website:

    bun run dev:site

Advanced OpenTUI terminal interface:

    bun run dev:tui

Hosted NestJS API:

    bun run dev:api

Both task and tk are CLI aliases. The CLI currently provides a polished help/version surface and JSON metadata mode; full workspace commands are still being implemented. The TUI currently provides an interactive navigation shell and is not yet connected to workspace files.

## Typecheck

    bun run typecheck

Do not treat a successful typecheck as proof that the runtime, native OpenTUI renderer, local security boundary, or product workflows are complete.

## Flutter mobile app

From source/apps/mobile:

    flutter pub get
    flutter run

The Flutter application is not part of the Bun workspace and does not import TypeScript package source.

## Task-managed Markdown files

YAML frontmatter is required only for Markdown files inside the configured Task-managed workspace. The workspace defaults to tasks/; a repository can select another directory in task.yaml. Ordinary repository Markdown outside that directory, including this engineering documentation, does not need Task frontmatter.

The common metadata fields are id, name, and type. Add frontmatter when creating Markdown files inside the managed workspace; the future task validate command will treat missing or invalid metadata there as an error.

## Current scope

This setup describes the project foundations, not completed product capabilities. The local runtime currently exposes only a health endpoint. Workspace discovery, safe file operations, runtime security, WebSocket reconciliation, API persistence/authentication, cloud sync, and end-user workflows remain future implementation work.
