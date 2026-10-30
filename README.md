# Task

Task is a local-first task and project management platform for individuals and organizations. It supports local repository work, optional cloud-connected workspaces, and cloud-native projects.

The intended interfaces are:

- **CLI** for developers and AI agents.
- **Local dashboard** for visual project and workspace management.
- **Hosted web application** for personal and organizational work across projects.
- **Mobile application** for access to work across devices.
- **Hosted API** for identity, organizations, cloud workspaces, collaboration, and synchronization.
- **Terminal interface** for advanced interactive terminal workflows.

All interfaces use one shared domain model. Local-only workflows remain useful without an account or hosted service. Users may optionally connect repository workspaces to Task Cloud or create cloud-native workspaces without Git.

## Repository conventions

- source/ contains application and package source code.
- .docs/ contains engineering documentation about the Task software project by convention.
- The Task-managed workspace defaults to tasks/, but can be configured to use another directory such as .docs/ or .tasks/.
- Only Markdown files inside the configured Task-managed workspace require Task YAML frontmatter.
- Root/common Markdown files outside that workspace, such as this README, do not require Task frontmatter.
- Root TODO.md, when introduced, is an overview/index rather than a second source of truth.
- No generated SDK directory is planned.

See [Repository documentation](.docs/README.md), [Task workspace conventions](tasks/README.md), the [install-once, use-in-any-project guide](.docs/guides/install-once-use-anywhere.md), [platform architecture](.docs/architecture/platform-architecture.md), and [Decision 0004](tasks/decisions/0004-hybrid-cloud-platform.md).

## Application experience standards

- All websites and browser applications use Next.js App Router.
- The advanced TUI uses OpenTUI with React bindings.
- The CLI uses terminal-aware colour and Clack prompts, while preserving JSON output and script/agent compatibility.
- task and tk invoke the same CLI.
- The hosted API remains a NestJS modular monolith; the mobile client remains Flutter.

See [Decision 0011](tasks/decisions/0011-application-experience-tooling.md) for the accepted framework and interface standards.

## CLI

The CLI is developed under source/apps/cli. Both task and tk invoke the same executable.

    task --help
    task --version
    task --json
    tk --help

The command surface is still a foundation; full workspace operations are being implemented in phases.

## Development setup

Install Bun 1.3.14 or later, then from the repository root:

    bun install
    bun run dev:cli

Run the local runtime and Next.js dashboard together:

    bun run dev:local

Run the hosted Next.js website:

    bun run dev:site

Run the advanced terminal interface:

    bun run dev:tui

Other root commands include dev:api and typecheck. Flutter remains independently managed from source/apps/mobile with Flutter tooling.

See [development setup](.docs/development/setup.md) for details.

## Branch workflow

- develop is the integration branch. Day-to-day work happens here.
- main is the stable branch. Promote reviewed changes from develop when ready.

## Project status

The repository contains starter foundations for the CLI, local runtime and Next.js dashboard, hosted Next.js website, NestJS API, Flutter mobile app, OpenTUI terminal interface, and shared TypeScript packages. These foundations are not completed product capabilities. Workspace discovery and operations, authentication, persistence, local security, API-backed workflows, synchronization, and production distribution remain implementation work. See the architecture documentation for the current boundaries and status.
