# Source layout and implementation boundaries

## Purpose

This document defines when code belongs under `source/`. It maps the accepted hybrid product architecture to an implementation tree without turning every conceptual capability into an empty package. Engineering documentation remains under `.docs/`; Task-managed records remain in the configured workspace (default `tasks/`). Do not add a generated `sdk/` directory.

## Current source tree

```text
source/
├── README.md
└── apps/
    └── cli/             # The only implemented application
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts
```

The CLI exposes the `task` and `tk` command names from one entry point. It currently provides the minimal help/version behavior documented in the repository setup guide.

## Product surfaces and future implementation boundaries

The product architecture describes capabilities, not a mandate to create a directory for each capability today.

| Product capability | Intended responsibility | Implementation boundary |
| --- | --- | --- |
| CLI | Local commands, repository operations, and agent workflows | Existing `apps/cli` |
| Local dashboard | Visual management of the current repository workspace; must work without account or network | Future web interface running against a local workspace runtime |
| Hosted web | Personal and organizational work, collaboration, and cloud-native workspaces | Future web client using the hosted API |
| Hosted API | Cloud identity, ownership, authorization, persistence, and shared operations | Future modular monolith under `apps/api` |
| Mobile | Focused access to authorized work across devices, with explicitly supported offline behavior | Future application; framework and package boundary remain undecided |
| TUI | Optional keyboard-driven terminal interface | Deferred; no commitment to a separate app yet |

The local dashboard and hosted web are distinct runtime/deployment responsibilities. Whether they share one web application and UI package, or become separate applications over shared client code, is intentionally unresolved until their runtime contracts and workflows are designed. The local dashboard must not depend on the hosted API; hosted clients must use the API for protected cloud data.

## API module boundaries

The hosted API is intended to start as one modular monolith, not microservices. Its conceptual modules are identity, organizations, workspaces, projects, tasks, documents, relationships, authorization, synchronization, search, activity, notifications, and integrations.

These are domain/module boundaries inside the API. They are not separate packages or separately deployable services. Create module directories when implementing the corresponding module and its real contracts; keep the module map in architecture documentation until then.

## Shared code and package boundaries

There are no shared package workspaces yet. Do not create one package per noun or product capability.

Introduce a shared package only when:
- a real implementation needs to be reused by at least two consumers, or a stable boundary must be independently versioned;
- its responsibility and public API can be stated precisely;
- its dependency direction is clear; and
- the package contains real code and tests or another concrete verification path, not only a placeholder `index.ts`.

Likely candidates to evaluate when implementation reaches them include:
- domain model and invariants;
- canonical schemas and API contracts;
- Markdown/document parsing and validation;
- local workspace/repository runtime;
- synchronization protocol/client;
- hosted API client.

These are candidates, not pre-approved package names or a required final package count. Related concepts may initially live together and split only when cohesion, independent change, or multiple consumers justify it. Avoid circular dependencies and avoid making local workflows import hosted-service infrastructure.

## Dependency and ownership rules

- Applications are composition roots; they wire domain behavior to runtime adapters.
- Domain rules must not depend on UI frameworks, databases, Git providers, or network transports.
- Local repository persistence and cloud persistence are different adapters; neither should be hidden inside document CRUD.
- The API owns server-side authentication, authorization, and tenant isolation for cloud operations.
- Synchronization is an explicit subsystem with revision, idempotency, conflict, deletion, and recovery semantics.
- Generated client artifacts must not be committed into a root `sdk/` directory. Client generation/distribution remains a separate decision.

## Implementation sequence

1. Define the local document/workspace contracts needed by the CLI.
2. Implement workspace discovery, document parsing, and validation in the smallest cohesive modules that serve real CLI workflows.
3. Add the local dashboard after its local runtime boundary is designed; keep it independent of hosted services.
4. Define cloud identity, ownership, authorization, persistence, and API contracts before implementing hosted API modules.
5. Design synchronization as its own protocol before connecting repository workspaces to cloud workspaces.
6. Add hosted web and mobile clients against stable API contracts.
7. Introduce additional packages or the TUI only when concrete reuse and workflow requirements justify them.

A directory's existence is not evidence that a capability is implemented.
