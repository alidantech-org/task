# Decision 0001: Repository conventions

- **Status:** Accepted
- **Date:** 2026-10-31
- **Scope:** Task repository and future initialized workspaces

## Context

Task needs clear separation between source code, engineering documentation, and the project records managed by Task itself.

## Decisions

1. The product name is **Task**.
2. The CLI will expose both `task` and `tk`, using one implementation.
3. Application and package source code belongs under `source/`.
4. `.docs/` is for engineering documentation about the Task software project.
5. `tasks/` is the visible, Task-managed workspace for task records and project context. The same convention is intended for workspaces created by `task init`.
6. Root `TODO.md`, if introduced, is an overview/index and not a second source of truth.
7. `develop` is the active integration branch; `main` is kept stable.

## Consequences

- Engineering setup and implementation guides belong in `.docs/`.
- Product requirements, research, decisions, handoffs, and task records managed through Task belong in `tasks/`.
- Avoid duplicating authoritative documents across the two locations.
- The CLI, dashboard, and terminal interface must eventually share the same workspace and domain behavior.

## Deferred

The task file schema, workspace configuration schema, lifecycle/status model, command registration, shared package boundaries, dashboard framework, and local API design require separate decisions.
