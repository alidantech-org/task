# Source layout

Application and shared package source lives under `source/` and is managed as Bun workspaces.

## Applications

- `apps/cli`: local command-line interface; `task` and `tk` share one entry point.
- `apps/web`: hosted web client.
- `apps/api`: hosted Task API, initially planned as a modular monolith.
- `apps/mobile`: mobile client.
- `apps/tui`: keyboard-driven terminal client.

## Shared packages

- `packages/core`: framework-independent domain primitives.
- `packages/schemas`: canonical schemas and contract definitions.
- `packages/documents`: Markdown and frontmatter interpretation.
- `packages/workspace`: workspace discovery, configuration, and identity.
- `packages/projects`: project domain.
- `packages/tasks`: task domain and lifecycle contracts.
- `packages/validation`: shared validation and diagnostics.
- `packages/synchronization`: connected-workspace sync contracts.
- `packages/identity`: account and principal contracts.
- `packages/authorization`: policy and access-control contracts.
- `packages/api-client`: typed hosted API client boundary.

These are ownership boundaries, not completed features. Contracts should be added only after their domain decisions are accepted. Applications depend on shared packages; shared packages must not depend on applications.

## Status

The CLI is the only application with a functioning command entry point. The other applications and packages are minimal TypeScript workspace shells. Web/mobile frameworks, API framework and persistence, domain schemas, sync protocol, authentication provider, and authorization policy remain undecided. No generated SDK is stored in this repository.
