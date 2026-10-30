# Source layout and package boundaries

## Purpose

This document maps the accepted [platform architecture](platform-architecture.md) to Bun workspace boundaries. Application and package source belongs under `source/`; engineering documentation remains under `.docs/`; Task-managed records remain in the configured workspace (default `tasks/`). Do not add a generated `sdk/` directory.

## Applications

| Path | Responsibility | Status |
| --- | --- | --- |
| `source/apps/cli` | Local commands, repository operations, and agent workflows; exposes `task` and `tk`. | Existing minimal help/version entry point. |
| `source/apps/web` | Hosted web client for personal and organizational work. | TypeScript shell; framework not selected. |
| `source/apps/api` | Hosted API and server-side authorization boundary. | TypeScript shell with documented module boundaries; framework/persistence not selected. |
| `source/apps/mobile` | Mobile access to cross-project work and supported offline workflows. | TypeScript shell; framework not selected. |
| `source/apps/tui` | Keyboard-driven terminal workflows. | TypeScript shell; UI library not selected. |

## Shared packages

| Package | Responsibility |
| --- | --- |
| `@task/core` | Framework-independent domain primitives and shared contracts. |
| `@task/schemas` | Canonical schema definitions and contract versions. |
| `@task/documents` | Markdown and frontmatter interpretation. |
| `@task/workspace` | Workspace discovery, configuration, and local identity. |
| `@task/projects` | Project domain contracts and behavior. |
| `@task/tasks` | Task domain, lifecycle, and relationships. |
| `@task/validation` | Shared validation and diagnostics. |
| `@task/synchronization` | Connected-workspace synchronization contracts. |
| `@task/identity` | User, principal, and client identity contracts. |
| `@task/authorization` | Authorization vocabulary and policy contracts. |
| `@task/api-client` | Typed client boundary for the hosted API. |

The API's planned modules are documented under `source/apps/api/src/modules/`: identity, organizations, workspaces, projects, tasks, documents, relationships, authorization, synchronization, search, activity, notifications, and integrations. They are modules in one planned modular monolith, not microservices.

## Dependency direction

- Applications may depend on shared packages; shared packages must not depend on applications.
- Schemas and domain rules are shared rather than reimplemented per client.
- The API owns server-side authorization and cloud operation boundaries.
- Local repository workflows must not require hosted API availability.
- Synchronization is a dedicated subsystem; ordinary document CRUD must not silently upload repository content.
- Avoid circular dependencies. Add package dependencies only when real imports require them and the owning contract is clear.

## Conventions and implementation order

Each workspace has a private package manifest, TypeScript project configuration, and placeholder entry point. The skeleton intentionally has no framework dependencies, database, ORM, auth provider, test runner, or code generator. A directory's existence is not evidence that its capability is implemented.

Implement in this order: shared identity/workspace/project/task/document contracts; schemas and document interpretation; local workspace discovery and validation; CLI integration; local dashboard; API identity/ownership/authorization; synchronization protocol; hosted web and mobile clients. Select UI and service frameworks against real workflows rather than scaffolding speculative technology.
