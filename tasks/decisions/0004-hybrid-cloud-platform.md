---
id: DEC-0004
name: Hybrid local-first and cloud-native Task platform
type: decision
status: accepted
created_at: 2026-10-31
---

# Decision 0004: Hybrid local-first and cloud-native Task platform

- **Status:** Accepted
- **Date:** 2026-10-31
- **Scope:** Task product direction, identity, workspaces, hosted API, web, mobile, CLI, and synchronization

## Context

Task began as a repository-native task and project management tool: one machine-wide CLI operates on project-local Markdown workspaces, with Git as a natural collaboration and history mechanism. The product should also serve people who do not work primarily in Git repositories and users who want to access their work across computers, browsers, and mobile devices.

The product must support both individuals and organizations without forcing every user into a cloud account or making local repository workflows dependent on hosted services.

## Decisions

1. **Adopt a hybrid product architecture.** Task supports local-first workspaces, repository workspaces connected to Task Cloud, and cloud-native workspaces.
2. **Keep local use independent.** A user can install and use Task locally without creating an account or connecting to a hosted service. Local-only workflows must remain useful when offline and when Task Cloud is unavailable.
3. **Make cloud use optional, not second-class.** Users may create an account and access supported workspaces through hosted web and mobile applications, as well as connected CLI and local interfaces.
4. **Support individuals and organizations.** Personal accounts and personal workspaces are first-class. Organizations are separate collaboration and ownership boundaries with memberships, roles, and access control. A user may belong to multiple organizations.
5. **Separate identity from work ownership.** A user profile represents a person and their preferences; it is not itself a project or organization. Workspaces own or contain projects, and membership grants users access to shared work.
6. **Use one shared domain model.** CLI, local dashboard, hosted website, mobile app, and API must use consistent definitions for workspaces, projects, tasks, documents, relationships, and permissions. Interfaces must not create competing business rules or independent authoritative task stores.
7. **Keep repository data portable.** Repository-backed work remains represented in the configured local workspace, using the accepted Markdown frontmatter contract and Git-compatible files. Connecting a repository must not make local files disposable or require cloud access for ordinary local operations.
8. **Introduce a hosted Task API.** The API provides authenticated access to cloud-native and connected workspaces, identity, organizations, projects, tasks, documents, synchronization, search, activity, and notifications. It is the shared service boundary for hosted clients.
9. **Provide a cloud-native mode.** Users can create and manage workspaces and projects in Task Cloud without a Git repository. Git integration may be connected later and is not a prerequisite.
10. **Treat synchronization as a first-class subsystem.** Connected workspaces require stable record identity, revision/change tracking, idempotent operations, conflict detection, deletion semantics, and recoverable synchronization. Offline clients must be able to queue supported changes and reconcile them later.
11. **Do not silently overwrite repository content.** Cloud changes must not silently replace local Markdown or other repository files. Conflicts and destructive operations must be visible, recoverable, and governed by an explicit policy.
12. **Enforce authorization at the API boundary.** Personal and organization data must be isolated. Every API operation must verify workspace membership and applicable permissions; client-side visibility is not an authorization mechanism.
13. **Start with a modular hosted service.** Prefer a clearly separated modular API over premature microservices. Service boundaries may evolve when scale and operational evidence justify it.
14. **Preserve local and hosted interface parity through shared contracts.** The CLI, local UI, hosted web app, and mobile app should consume shared domain capabilities and API contracts rather than independently defining their own data semantics.

## Workspace modes

- **Local:** repository-backed or local workspace data remains on the user's machine. No account or network connection is required.
- **Connected:** a repository-backed workspace has a linked Task Cloud representation. Local files and Git remain available; supported changes synchronize through the Task sync subsystem.
- **Cloud-native:** the workspace and its records are created and managed in Task Cloud. A Git repository is optional.

The exact authority rules for individual fields and records in connected mode must be specified before synchronization is implemented. The architecture must support explicit conflict handling rather than assuming that Git or the cloud always wins.

## Product audience and access model

- Individuals can own personal workspaces and projects.
- Organizations can own shared workspaces and projects.
- A user can access their personal work and multiple organizations from one account.
- A project can be visible to multiple authorized members according to workspace and project permissions.
- Cross-project views such as My Work aggregate only records the signed-in user is authorized to see.
- Personal and organization ownership, membership, invitations, roles, and permission inheritance require explicit domain rules.

## Consequences

- Task is no longer described as only a repository-native tool; it is a hybrid work platform whose repository-native workflow remains a foundational mode.
- Identity, workspace ownership, organization membership, authorization, and synchronization become core architectural concerns.
- The hosted API and cloud persistence must be designed around the same schemas and domain rules used locally.
- Web and mobile become first-class clients, not separate products with separate task models.
- The local CLI and dashboard must continue to work without cloud credentials for local-only work.
- Cloud-native records must remain exportable and must use compatible domain/document semantics where applicable.
- Security, tenant isolation, privacy, backups, observability, and service operations become required parts of the hosted platform design.

## Deferred decisions

The following are intentionally not fixed by this decision:

- Database engine, hosting provider, deployment topology, and storage services.
- Authentication provider, supported sign-in methods, session model, and account recovery.
- Exact organization roles, permission matrix, invitation flow, and project-level overrides.
- Workspace and project ownership transfer rules.
- Connected-workspace source-of-truth policy, conflict resolution UX, merge strategy, and revision retention.
- Sync transport, push/pull protocol, event format, retry/backoff policy, and offline queue guarantees.
- Cloud-native document storage representation and export/import format.
- API versioning, generated client strategy, and whether any SDK artifacts are published separately.
- Attachment storage, size limits, encryption, and retention.
- Notification delivery channels and user preferences.
- Billing, quotas, pricing, and commercial packaging.
- Mobile framework and exact offline feature scope.
- Git provider integration and repository linking/authorization.
- Data residency, retention, deletion, and compliance requirements.

These decisions must be designed before the corresponding production features are implemented; they must not be guessed in individual clients.
