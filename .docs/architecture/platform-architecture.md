# Task platform architecture

## 1. Purpose and product direction

Task is a hybrid task and project work platform for **individuals and organizations**. It combines repository-native local work with optional hosted collaboration and cloud-native projects.

The product has one domain model and multiple clients:

- CLI for people and AI agents, including validation and cloud connection/sync commands.
- Local dashboard for repository-backed work, served locally through a CLI-managed runtime.
- TUI for people who prefer an interactive keyboard-driven terminal experience.
- Hosted website for personal and organizational work, with local and cloud runtime modes.
- Mobile application for cross-project access and mobile workflows.
- Standalone hosted NestJS API at `source/api/` as the service boundary for cloud-native and connected workspaces.

The accepted product decision is recorded in [Decision 0004](../../tasks/decisions/0004-hybrid-cloud-platform.md).

## 2. Architectural principles

1. **Local-first, not local-only:** local workflows remain useful without an account, network, or hosted service.
2. **Cloud optional, cloud capable:** users can opt into synchronization or create cloud-native workspaces.
3. **One domain, multiple interfaces:** clients share schemas, identifiers, validation, lifecycle rules, and authorization semantics.
4. **Repository portability:** repository-backed records remain inspectable, editable, and versionable as files.
5. **Explicit synchronization:** connected workspaces use revision-aware synchronization and visible conflict handling.
6. **Security by boundary:** the API enforces identity, workspace membership, organization isolation, and permissions on every protected operation.
7. **Modular before distributed:** begin with a modular API and separate deployable applications; do not introduce microservices without evidence.
8. **Exportability:** cloud-native work should not be trapped in an opaque application-only representation.
9. **Schema before interface:** domain and document contracts precede client-specific screens and workflows.

## 3. Product surfaces

| Surface | Primary responsibility | Local/cloud behavior |
| --- | --- | --- |
| CLI | Commands, automation, repository operations, agent workflows | Local without login; authenticated cloud commands when connected |
| Local dashboard | Visual management of the current repository workspace | Runs locally; cloud connection optional |
| Hosted web | Account, personal work, organizations, projects, collaboration | Authenticated Task Cloud client |
| Mobile | My Work, project/task access, updates, notifications, supported offline actions | Authenticated cloud client with local cache and sync |
| Hosted API | Shared cloud operations and authorization | Required for cloud-native and connected cloud operations |

These are product responsibilities, not a claim that all surfaces or features already exist.

## 4. Workspace and ownership model

Keep the concepts distinct:

- **User:** an account identity and personal profile. A profile stores user preferences and account-facing information; it is not a project container.
- **Personal workspace:** a private workspace owned by one user.
- **Organization:** a collaboration and ownership boundary with members and roles.
- **Organization workspace:** work owned by or managed within an organization.
- **Workspace:** the boundary for settings, membership/ownership, projects, and records. The precise relationship between an organization and its workspaces remains a schema decision.
- **Project:** a collection of related tasks, documents, milestones, and project settings within a workspace.
- **Task/document:** stable records with shared identifiers and metadata semantics.
- **Membership:** an explicit relationship granting a user access to a personal or organization-owned workspace.
- **Device/client installation:** a registered client identity used for sync/security management where needed; it must not be confused with a user or workspace.

A user may have personal workspaces and membership in multiple organizations. A cross-project view such as My Work is a query over accessible workspaces and projects, filtered by assignment or other defined responsibility—not a second task store.

### Workspace modes

#### Local

A workspace is stored locally, normally within a repository's configured Task-managed directory. The default remains tasks/. The CLI and local dashboard operate without an account. Git can provide history and collaboration.

#### Connected

A local repository workspace is linked to a cloud workspace. The repository retains its files and can be used offline. Task Cloud provides remote access for authorized web/mobile clients and other devices. Synchronization carries changes between the local representation and cloud representation.

A connection must be explicit and revocable. The product must show which repository is linked to which cloud workspace and which account or organization controls access.

#### Cloud-native

A workspace is created in Task Cloud without a local repository. The hosted API is the authoritative service for that workspace. Clients may cache data locally and export records. A Git repository can be linked later, but is not required.

## 5. Logical system architecture

~~~text
                    Task clients
    +-----------+-----------+----------------+-----------+
    | CLI / TUI | Local site| Hosted website | Mobile app|
    +-----------+-----------+----------------+-----------+
          |          |              |              |
          +----------+              +--------------+
                |                          |
                v                          v
       +-------------------+       +---------------------+
       | CLI-managed local |       | Standalone NestJS   |
       | runtime           |       | API: source/api/    |
       |                   |       |                     |
       | Local HTTP + WS   |       | Identity / tenancy  |
       | Workspace access |       | Workspaces/projects |
       | File watching    |       | Tasks/documents     |
       | Local operations  |       | Authorization       |
       +---------+---------+       | Synchronization     |
                 |                 | Search/activity/etc |
                 v                 +----------+----------+
          Repository files                    |
          and Git history                     v
                                    Cloud persistence

          Connected repository <--> Sync subsystem <--> Hosted API

       Local site uses local runtime only in local mode.
       Hosted site and mobile use hosted API directly.
~~~

The shared domain is not a requirement that every client run the same runtime. It means domain schemas, invariants, and API contracts have one authoritative definition and are consistently enforced. The CLI-managed local runtime mediates local workspace access and exposes HTTP/WebSocket interfaces to local clients. The hosted API is a separate NestJS project and deployment. Local live-update events and cloud synchronization changes are separate protocols.

## 6. Hosted API domain modules

Start as a modular monolith with explicit module boundaries:

| Module | Responsibilities |
| --- | --- |
| Identity | Accounts, profiles, authentication integration, sessions |
| Organizations | Organization lifecycle, membership, invitations, roles |
| Workspaces | Workspace ownership, settings, mode, repository connection |
| Projects | Project metadata, lifecycle, organization and workspace relationships |
| Tasks | Task records, status, priority, assignment, scheduling |
| Documents | Markdown content, frontmatter, document types, decisions and handoffs |
| Relationships | Dependencies, hierarchy, references, cross-record links |
| Authorization | Access checks, policy evaluation, permission enforcement |
| Synchronization | Device/workspace registration, revisions, change exchange, conflicts |
| Search | Authorized search and cross-project aggregation |
| Activity | Comments, change history, audit events |
| Notifications | Mentions, assignment updates, reminders and delivery preferences |
| Integrations | Git providers and future external services |

Modules may share a deployment and database initially, but should not bypass one another's domain contracts. API authorization is mandatory even when the caller is an authenticated user.

## 7. Data ownership and persistence boundaries

The product has two persistence environments:

- **Local repository persistence:** configured workspace files, YAML frontmatter, Markdown bodies, and Git history.
- **Cloud persistence:** records for cloud-native workspaces and synchronized representations of connected workspaces, plus account, membership, activity, and synchronization metadata.

Do not introduce a global cloud database as a prerequisite for local mode. Do not make the local repository a disposable cache for connected mode.

The cloud data model must preserve stable record identity and relationships across clients. It must distinguish user identity, workspace ownership, organization membership, project membership/visibility, and record assignment.

The database engine, object storage, physical schema, and exact mapping between Markdown files and cloud records remain open decisions.

## 8. Synchronization architecture

Synchronization is a dedicated subsystem, not a background upload hidden inside document CRUD.

### Required concepts

- Stable workspace and record identifiers that survive local moves and repository clones according to explicit identity rules.
- A workspace connection linking a local repository to a cloud workspace.
- A revision or version for each synchronized record, plus a workspace change cursor or equivalent incremental position.
- An ordered or causally interpretable change representation.
- Idempotency keys so retried operations do not duplicate mutations.
- Change origin and actor metadata where available.
- Explicit deletion/tombstone semantics so deletions propagate safely.
- Conflict detection when the local and cloud versions have diverged.
- Retryable sync operations and observable sync status.
- A recoverable path for users to inspect, resolve, or discard conflicting changes.
- Local queueing for supported offline operations.

### Initial sync flow

1. The user explicitly connects a local repository workspace to a cloud workspace.
2. Task verifies identity and permission to connect both sides.
3. Task inspects local and remote records and presents the initial reconciliation plan.
4. The user confirms the initial link/reconciliation.
5. The sync engine exchanges records and establishes revision/cursor state.
6. Later local changes are detected and queued for upload; cloud changes are fetched for local application.
7. Each change is validated against the shared schema and authorization rules.
8. Divergent edits are surfaced as conflicts. Task does not silently overwrite either side.
9. Successful changes advance revision/cursor state and are safe to retry.

This is a target flow. Exact merge algorithms, ordering guarantees, and user experience require a separate synchronization design before implementation.

### Authority and conflict policy

Do not assume a universal winner. Git is authoritative for the local repository's committed history; the cloud service is authoritative for cloud-native workspaces. In connected mode, authority can depend on the record, field, and operation. That policy must be explicitly defined and exposed to users.

The sync design must address edits from multiple computers, edits from web/mobile while a local repository is offline, concurrent Git branch changes, renames/moves, deletions, schema migrations, and permission revocation.

## 9. Identity, tenancy, and authorization

- Account identity is distinct from organization membership and workspace ownership.
- Personal workspaces and organization workspaces have explicit owners.
- A user can belong to multiple organizations.
- Membership and role checks are enforced server-side for every protected API operation.
- Cross-project aggregations must only include records the current principal can access.
- Client-side filtering is not a security boundary.
- A repository connection is an explicit authorization grant and must be revocable.
- Tokens and credentials must not be stored in repository Markdown or committed configuration.
- Secrets are stored in an appropriate local credential facility or secure client storage, not in plain text project files.
- Audit-sensitive events include membership/role changes, workspace access changes, repository connection changes, and destructive operations.

The exact role hierarchy, invitation policy, authentication provider, session lifecycle, and permission matrix remain open.

## 10. Web and mobile clients

### Hosted web

The hosted website provides account/profile management, personal workspace navigation, organization switching, project management, cross-project My Work, search, collaboration, and workspace administration. It is a client of the hosted API, not a separate domain implementation.

### Mobile

The mobile app provides a focused view of work across personal and authorized organization workspaces:

- My Work across accessible projects.
- Task details, status and supported edits.
- Project browsing and progress.
- Inbox, mentions, assignments, and notifications.
- Deadlines and calendar views.
- Cached previously synchronized information.
- Queued supported offline changes with visible sync state.

Mobile should be designed around high-frequency workflows, not a compressed copy of the desktop dashboard. Exact offline capabilities, framework, push delivery, and attachment behavior remain to be decided.

## 11. Security and operational requirements

A hosted product introduces responsibilities absent from local-only mode:

- Tenant isolation and authorization tests.
- Secure authentication and session/token handling.
- Encryption in transit and appropriate protection at rest.
- Secret management and key rotation.
- Backups and tested restore procedures.
- Data export and account/workspace deletion policies.
- Audit logging for security-sensitive actions.
- Rate limits, abuse controls, and API input validation.
- Observability for API health, sync lag, failures, and queue depth.
- Versioned migrations and compatibility management.
- Attachment scanning and storage controls if attachments are introduced.
- Privacy, retention, and data residency requirements appropriate to supported markets.

Do not expose the local dashboard to a network by default. Local-only mode should not unexpectedly transmit repository contents.

## 12. Repository structure and implementation boundaries

Keep all application and package source under `source/`, but do not scaffold every conceptual product surface as an empty workspace. The current implementation tree contains only the CLI. The standalone hosted API, site (local dashboard and hosted website modes), mobile app, and TUI are intended application boundaries but are not scaffolded yet; their responsibilities are described in [source layout and implementation boundaries](source-layout.md).

The local dashboard and hosted website are distinct runtime/deployment modes of one intended site product. They may share UI/application code, but local mode uses the CLI-managed local runtime and cloud mode connects directly to the hosted API. Mobile framework selection is deferred. TUI is an accepted future application boundary for an interactive terminal experience; it is not scaffolded yet.

Shared packages must emerge from stable contracts and real reuse. Do not create one package per domain noun, API module, or planned feature. Start with cohesive code inside the application that owns the workflow, then extract a package when multiple consumers, independent versioning, or a clear architectural boundary justify it. The API starts as a modular monolith; its domain modules are internal modules, not microservices or separate packages.


## 13. Local runtime, site modes, and TUI

### CLI and local runtime

The CLI is the primary scriptable interface for people and agents. It manages tasks and documents, validates the configured workspace, and provides optional login, cloud workspace linking, and synchronization commands. Local commands remain usable without an account or network.

The CLI starts or manages a local runtime for the dashboard. Initially, the runtime belongs to the CLI application; it should not become a separate package or service until implementation demonstrates a clear independent lifecycle. It mediates access to the selected Task-managed workspace, watches/reconciles file changes, and exposes a restricted local HTTP interface plus WebSocket live-update channel.

Bind the local runtime to loopback by default. Protect it against cross-origin browser requests, use a local authorization/capability mechanism for sensitive operations, restrict access to the selected workspace, and never expose arbitrary filesystem access or shell execution. WebSocket clients must be able to reconnect and request a fresh snapshot or catch up from a cursor. Filesystem watcher events are hints, not authoritative change records.

### Site: local and cloud modes

The intended site is one product with two runtime/deployment modes:

- **Local mode:** served locally by the CLI-managed runtime; uses local HTTP/WebSocket to manage repository-backed work. It must not depend on Task Cloud.
- **Cloud mode:** deployed as the public website; connects directly to the hosted NestJS API for authenticated cloud data. It must not depend on a user's local runtime.

Share UI/application code where practical while keeping local and cloud runtime adapters separate. Do not create two independent website implementations unless concrete workflows or deployment constraints justify it.

### Mobile

The mobile application connects directly to the hosted API. It does not route cloud operations through a user's local runtime. Its framework, caching, push delivery, and supported offline operations remain open decisions.

### TUI

The TUI is a separate interactive, keyboard-driven terminal interface for people. It complements the scriptable CLI and is not the primary agent/automation interface. It must reuse the same domain/workspace operations and validation rules as the CLI and local dashboard; it must not create a competing task model or bypass workspace access controls. Begin with local workspace workflows. Add authenticated cloud workflows only through the established API and synchronization contracts. Framework and keybinding decisions are deferred.

### Local live updates vs cloud synchronization

The local runtime's WebSocket broadcasts changes to local clients. Cloud synchronization is a separate subsystem that exchanges authorized, revision-aware changes with the hosted API. WebSocket delivery does not provide durable synchronization, conflict resolution, or authorization. Reconnection requires snapshot/cursor recovery; sync requires stable IDs, revisions, idempotency, deletion semantics, conflict detection, and recoverability.

## 14. Recommended implementation sequence

1. **Domain foundations:** finalize local document/workspace contracts and shared task/project semantics; implement CLI discovery and validation.
2. **Local runtime:** design safe workspace access, HTTP/WebSocket interfaces, file watching, and reconnect/snapshot behavior inside the CLI application.
3. **Local site:** implement the local dashboard against the local runtime.
4. **Cloud foundations:** define API contracts, identity, personal workspaces, organizations, membership, authorization, and cloud persistence; build the standalone NestJS project under `source/api/`.
5. **Cloud-native website:** implement hosted site mode against the API.
6. **Connected workspace protocol:** specify and implement registration, revisions, change exchange, idempotency, conflict handling, deletion, and recovery; then connect CLI login/link/sync workflows.
7. **TUI:** design and implement the interactive terminal interface against the same local workspace operations and validation contracts.
8. **Mobile client:** authentication, My Work, project/task workflows, cache, offline queue, and notifications.
9. **Integrations and scale:** Git provider integration, automation, advanced analytics, and operational decomposition only when justified.

Do not build mobile screens or a large API surface before the shared domain, authorization, and sync contracts are stable.

## 14. Open architecture decisions

These require dedicated design work:

- Exact relationship between organizations, workspaces, and projects.
- Workspace and project ownership transfer.
- Authentication and account recovery.
- Organization roles, permissions, invitations, and project-level overrides.
- Cloud persistence engine and deployment/hosting provider.
- Markdown-to-cloud record mapping and cloud-native export format.
- Connected-mode authority and conflict resolution.
- Sync protocol, change ordering, cursors, retries, and offline guarantees.
- Stable IDs and clone/fork identity semantics.
- API versioning and client contract generation.
- Attachments, notifications, billing, quotas, and data retention.
- Mobile framework and supported offline operations.
- Git provider integration and repository access authorization.

These decisions must be resolved in their own design records before implementation depends on them.

## Source implementation status

Only the CLI is currently scaffolded as an application. The standalone NestJS API, site (local dashboard and hosted website modes), mobile app, and TUI remain architectural targets, not implemented code. The API module map is conceptual and will be materialized inside one modular monolith as each module is designed. No shared package boundaries have been established yet. See [source layout and implementation boundaries](source-layout.md).
