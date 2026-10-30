# Task

Task is a local-first task and project management platform for individuals and organizations. It supports local repository work, optional cloud-connected workspaces, and cloud-native projects.

The product includes a scriptable CLI, local Next.js dashboard, hosted Next.js website, NestJS API, Flutter mobile client, and OpenTUI terminal interface. The TypeScript applications and shared packages are managed by one root Bun workspace. Flutter remains on its native Dart toolchain and is exposed through root convenience scripts.

## Repository conventions

- source/ contains application and package source code.
- tasks/docs/ contains engineering documentation about the Task software project by convention.
- The Task-managed workspace defaults to tasks/. Engineering docs in tasks/docs/ carry frontmatter so the local application can discover them; root README.md and AGENTS.md remain ordinary Markdown.
- Only Markdown files inside the configured Task-managed workspace require Task YAML frontmatter.
- Root/common Markdown files outside that workspace, such as this README, do not require Task frontmatter.
- Root TODO.md, when introduced, is an overview/index rather than a second source of truth.
- No generated SDK directory is planned.

See [Repository documentation](tasks/docs/README.md), [Task workspace conventions](tasks/README.md), the [install-once, use-in-any-project guide](tasks/docs/guides/install-once-use-anywhere.md), [platform architecture](tasks/docs/architecture/platform-architecture.md), and [Decision 0011](tasks/decisions/0011-application-experience-tooling.md).

## Application experience

- All websites and browser applications use Next.js App Router.
- The advanced TUI uses OpenTUI with React bindings.
- The CLI uses terminal-aware colour and Clack prompts, while preserving JSON output and script/agent compatibility.
- task and tk invoke the same CLI.
- The hosted API is a NestJS modular monolith; mobile is Flutter.

## Install and run

Requirements: Bun 1.3.14 or later, and Flutter SDK for mobile validation/development.

From the repository root:

    bun install

Start the complete local development stack:

    bun dev

This keeps the API, hosted site, local runtime, and local dashboard running together. The development URLs are API `http://127.0.0.1:3000` (OpenAPI at `/api/docs`), hosted site `http://127.0.0.1:5174`, and local dashboard `http://127.0.0.1:5173`; the local runtime listens on `127.0.0.1:4317`. Press Ctrl+C to stop the stack. If any service exits, the stack stops its peers.

Run individual applications or terminal tools separately:

    bun run dev:cli
    bun run dev:local
    bun run dev:site
    bun run dev:api
    bun run dev:tui
    bun run dev:mobile

The local command starts the loopback runtime and local Next.js dashboard together. The CLI and TUI run separately because the CLI is one-shot and the TUI needs an interactive terminal. Flutter commands are delegated to the Flutter SDK from the root scripts.

## Quality gates

Format source:

    bun run format

Run the complete validation pipeline:

    bun run validate

The validation command checks formatting, dependency advisories, Biome lint/security rules, TypeScript across all Bun workspaces, Bun tests, production builds for the API and both Next.js apps, and Flutter analysis/tests.

Useful individual commands:

    bun run format:check
    bun run lint
    bun run typecheck
    bun run test
    bun run audit
    bun run security
    bun run build
    bun run mobile:analyze
    bun run mobile:test

Run flutter pub get through the root bridge before the first mobile validation:

    bun run mobile:pub:get

bun run validate is the single root quality gate. It requires installed Bun dependencies, a current Bun lockfile, Flutter SDK/dependencies, and network access for the dependency advisory audit.

See [development setup](tasks/docs/development/setup.md) and [source layout](tasks/docs/architecture/source-layout.md).

## Branch workflow

- develop is the integration branch. Day-to-day work happens here.
- main is the stable branch. Promote reviewed changes from develop when ready.

## Project status

The repository contains working starter entry points and root-managed quality commands, not completed product capabilities. The API and local runtime expose liveness/readiness endpoints; the browser apps render starter screens; the CLI supports help, version, JSON metadata and environment checks; the TUI has keyboard navigation; and `@task/workspace` provides an in-memory Markdown metadata index, incremental reconciliation, explicit body reads, and optional watching. Internal TS imports use #/ aliases in Bun projects and @/ aliases in Next.js apps, with package names across project boundaries. Full workspace commands/CRUD, browser access to workspace data, authentication, persistence, local API security, collaboration, synchronization, and production distribution remain future implementation work.
