---
id: DEC-0009
name: Bun monorepo, application scaffolds, and shared packages
type: decision
status: accepted
created_at: 2026-10-31
---

# Decision 0009: Bun monorepo, application scaffolds, and shared packages

- **Status:** Accepted, with application tooling superseded by Decision 0011
- **Date:** 2026-10-31
- **Scope:** Source workspace layout, JavaScript/TypeScript application tooling, shared packages, and initial framework foundations

## Context

Task has multiple related applications and reusable code. Managing each TypeScript project independently would duplicate dependency installation and scripts. The repository needs one root-managed workspace while preserving clear application boundaries and the separate Dart toolchain.

## Decisions

1. **One root Bun workspace.** The repository root package.json owns the Bun workspaces, shared development dependencies, and cross-project scripts. It includes source/api, source/apps/*, and source/packages/*.
2. **Each workspace keeps its own manifest.** Every Bun-managed application and shared package has a local package.json for its name, dependencies, scripts, and exports. Installation and orchestration are performed from the repository root.
3. **Keep source ownership under source/.** Hosted API code lives in source/api/; applications live in source/apps/; reusable packages live in source/packages/.
4. **Use Next.js for every website and browser application.** The local dashboard and hosted site are separate Next.js App Router applications, not Vite applications. The local runtime remains a separate process and security boundary.
5. **Keep the local runtime owned by apps/local.** The local application includes a local server/runtime entry and a separate Next.js browser application. The browser must not gain arbitrary filesystem access; security and workspace-scoped operations must be implemented before exposing data or mutations.
6. **Use NestJS for the hosted API.** source/api/ is an independently runnable NestJS modular-monolith project.
7. **Keep Flutter outside Bun workspaces.** apps/mobile is a Flutter/Dart project managed through pubspec.yaml and Flutter tooling. It communicates directly with the hosted API and does not import TypeScript package source.
8. **Use OpenTUI with React for the advanced TUI.** The TUI uses the native OpenTUI renderer, React bindings, keyboard interaction, responsive terminal layouts, and shared workspace operations rather than creating a second domain model.
9. **Build a polished CLI experience.** The CLI uses terminal-aware colour, carefully formatted help/status output, @clack/prompts for interactive prompts, and machine-readable output with predictable exit codes. task and tc remain aliases.
10. **Use source/packages/ for real shared code.** Shared packages are first-class Bun workspaces. Create or retain a package only when it has a clear responsibility, real implementation, and actual consumers or a stable contract. Do not create empty placeholders or a catch-all package.
11. **Keep language boundaries explicit.** TypeScript packages may be shared by Bun applications. Flutter consumes equivalent Dart contracts, generated from a language-neutral source or maintained in Dart; it does not import TypeScript.
12. **Keep application responsibilities separate.** Sharing contracts or domain primitives does not merge local and hosted screens, state, routing, runtime, or deployment.
13. **Do not claim scaffolding is feature completion.** Health endpoints and starter screens are foundations only. Workspace discovery, authorization, persistence, sync, security hardening, and product workflows require their own implementation.

## Initial shared package boundaries

- @task/contracts: transport-neutral TypeScript types shared by TypeScript applications.
- @task/workspace: local workspace primitives shared by local consumers; filesystem operations must add symlink-aware protections and managed-boundary validation.

These are initial, narrow foundations, not a commitment to create every conceivable package. Further packages require demonstrated reuse and a stable API.

## Root commands

The root provides scripts for the CLI, local runtime, local dashboard, hosted site, API, TUI, and workspace typechecking. Project-specific scripts remain in each workspace manifest. The root package manager is Bun 1.3.14 or later to satisfy OpenTUI's native runtime requirement.

## Consequences

- A single root bun install resolves dependencies for Bun-managed applications and packages.
- The root package manifest is the workspace orchestrator; it does not replace per-project manifests.
- Flutter dependencies and commands remain managed by Flutter/Dart.
- The local dashboard and hosted site share Next.js, but remain separate applications.
- The CLI and TUI share workspace operations, not terminal presentation or interaction models.
- Shared packages are discoverable and linkable through Bun workspaces while remaining independently owned.

## Deferred

- Exact NestJS module boundaries, API persistence, auth and deployment.
- Full local server lifecycle, HTTP/WebSocket contracts, origin/capability security and CLI integration.
- UI design system and the amount of component sharing.
- API schema source and Dart client/code generation strategy.
- Additional shared package extraction as actual consumers emerge.
