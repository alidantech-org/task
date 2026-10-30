---
id: DEC-0005
name: Source tree implementation boundaries
type: decision
status: accepted
created_at: 2026-10-31
---

# Decision 0005: Source tree implementation boundaries

- **Status:** Accepted
- **Date:** 2026-10-31
- **Scope:** Source directories, application workspaces, shared packages, and API module boundaries

## Context

The first source scaffold created placeholder workspaces for five applications and eleven shared packages. Those directories implied implementation and ownership decisions that had not been made: the local dashboard and hosted web runtime boundary was unclear, the mobile framework was undecided, API modules were represented as directory shells, and the shared packages had no accepted contracts or real consumers.

The hybrid product direction remains accepted in [Decision 0004](0004-hybrid-cloud-platform.md). This decision corrects how that direction is represented in the repository; it does not remove the planned product capabilities.

## Decisions

1. Keep all application and package source under `source/`.
2. Keep only the CLI as a scaffolded application until another application has a designed runtime boundary and real implementation work.
3. Treat the local dashboard and hosted web as distinct runtime responsibilities. Decide whether they share one web application/UI package or use separate application shells only after defining the local runtime and hosted API contracts.
4. Treat the hosted API as one modular monolith initially. Identity, organizations, workspaces, projects, tasks, documents, relationships, authorization, synchronization, search, activity, notifications, and integrations are internal module boundaries, not microservices or separate packages.
5. Do not pre-create API module directories or placeholder application shells. Add them with the first real implementation of the corresponding boundary.
6. Do not create one shared package per domain noun or product capability. Start with cohesive code in the owning application and extract packages only for stable contracts, justified reuse, independent versioning, or a clear architectural boundary.
7. Defer mobile framework and application packaging until mobile workflows and offline requirements are designed.
8. Keep TUI optional and deferred; it is not a required application workspace at this stage.
9. Keep generated SDK artifacts out of a root `sdk/` directory. Client generation and distribution remain separately undecided.
10. Update architecture and setup documentation whenever implementation boundaries change. A documented product capability must not be presented as an implemented application.

## Consequences

- The current source tree contains only `apps/cli`.
- Bun workspaces include only the CLI until another real application or shared package is introduced.
- Product architecture documentation continues to describe the local dashboard, hosted web, hosted API, and mobile product surfaces without creating empty directories for them.
- Shared packages and API modules will be added incrementally when contracts and real code justify them.
- The source tree remains free of speculative placeholder workspaces.

## Revisit when

Revisit the boundary when implementing the local dashboard, hosted API, hosted web client, mobile client, or when a concrete second consumer justifies extracting shared code.
