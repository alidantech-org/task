# Task platform architecture

## 1. Product direction

Task is a local-first task and project work platform for individuals and organisations. It provides a useful local product without an account or network, with optional cloud workspaces and collaboration added separately.

The product has distinct application boundaries:

- **CLI:** scriptable local interface for people and AI agents.
- **Local application:** local runtime and browser dashboard for a selected file-based workspace.
- **Hosted website:** cloud application at `https://task.alidantech.org`.
- **Hosted API:** standalone NestJS service at `https://task-api.alidantech.org`.
- **Mobile:** Flutter application connecting to the hosted API.
- **TUI:** future keyboard-driven terminal interface.

The local application and hosted website are separate applications. They may share selected UI components, design tokens, schemas, and domain code, but they do not have to share full screens or runtime behavior.

Accepted decisions: [0004 — Hybrid platform](../../tasks/decisions/0004-hybrid-cloud-platform.md), [0005 — Client/runtime architecture](../../tasks/decisions/0005-client-local-runtime-and-api-architecture.md), [0006 — Local and hosted application boundaries](../../tasks/decisions/0006-local-and-hosted-application-boundaries.md), [0007 — File-based workspaces](../../tasks/decisions/0007-file-based-local-workspaces.md), and [0008 — Multi-device sync](../../tasks/decisions/0008-multi-device-two-way-sync.md).

## 2. Architectural principles

1. Local work remains useful without an account, network, or hosted service.
2. Workspace records are stored in portable files; files are authoritative for local work.
3. Git is optional and remains independent of Task Cloud synchronisation.
4. CLI and local dashboard use the same workspace operations and validation rules.
5. The local application mediates browser access to local files; browser code never gets arbitrary filesystem access.
6. The hosted website and mobile application communicate directly with the hosted API.
7. Cloud synchronisation is a dedicated, revision-aware subsystem, not a side effect of CRUD or WebSocket events.
8. One cloud workspace may synchronise with multiple local device replicas.
9. Conflicts and destructive operations must be visible and recoverable; never silently overwrite work.
10. Start with a modular NestJS API, not microservices.
11. Do not scaffold empty applications or speculative shared packages.

## 3. Product surfaces

| Surface | Responsibility | Connectivity |
| --- | --- | --- |
| CLI | Workspace discovery, task/document operations, validation, automation, later cloud commands | Local commands work offline and without the local server |
| Local application | Browser dashboard, local HTTP API, WebSocket, file watching and workspace access | Runs on the user's computer; no cloud dependency for local work |
| Hosted website | Accounts, personal workspaces, organisations, collaboration and cloud-native work | `task.alidantech.org` → hosted API |
| Hosted API | Identity, authorisation, cloud workspaces, persistence and sync service | `task-api.alidantech.org` |
| Flutter mobile | Focused mobile access to authorised cloud workspaces | Direct hosted API client |
| TUI | Interactive terminal interface for people | Future local client using shared workspace operations |

## 4. Workspace and ownership concepts

Keep these concepts distinct:

- **User:** account identity and personal profile.
- **Personal workspace:** workspace owned by one user.
- **Organisation:** collaboration and ownership boundary with members and roles.
- **Organisation workspace:** workspace owned by or managed within an organisation.
- **Workspace:** boundary for configuration, projects, records, ownership and access.
- **Project:** collection of related tasks, documents, milestones and settings.
- **Task/document:** stable records with shared identifiers and metadata semantics.
- **Membership:** relationship granting a user access to a workspace.
- **Device/replica:** registered local installation with its own synchronisation progress; not the same thing as a user, workspace, or Git clone.

A user may own personal workspaces and belong to multiple organisations. Cross-project views such as My Work aggregate authorised records; they are not a separate task store.

## 5. Workspace modes

### Local

A workspace is a directory containing Task configuration and managed files. It does not require a Git repository, account, network, or hosted service. The default managed folder is `tasks/`, configurable through root `task.yaml`.

### Connected

A local workspace is explicitly linked to a cloud workspace. Its local files remain usable offline. Task Cloud provides authorised access for the hosted website, mobile clients, and other connected devices. Changes synchronise in both directions.

A cloud workspace may have multiple local replicas on different computers. Each replica has independent local files, device identity, and sync progress.

### Cloud-native

A workspace is created and managed in Task Cloud without a local workspace or Git repository. The hosted API is authoritative for cloud-native records. Data must remain exportable.

## 6. Logical system architecture

```text
                  Local computer
       +----------------+------------------+
       | CLI            | Local application|
       | task / tk      | Dashboard        |
       | Direct local   | Local HTTP + WS  |
       | workspace ops  | File watcher     |
       +--------+-------+---------+--------+
                |                 |
                +--------+--------+
                         |
                Shared workspace rules
                         |
                 Local workspace files
                 (Git optional)


        Computer A                         Computer B
   +-------------------+              +-------------------+
   | CLI + Local app   |              | CLI + Local app   |
   | Local files       |              | Local files       |
   | Replica A         |              | Replica B         |
   +---------+---------+              +---------+---------+
             |                                  |
             +---------------+  +---------------+
                             |  |
                       Task Cloud sync
                             |
                   +---------v----------+
                   | Hosted NestJS API  |
                   | task-api.alidantech.org
                   +---------+----------+
                             |
                   Cloud persistence
                             ^
                             |
                  +----------+----------+
                  |                     |
             Hosted website        Flutter mobile
          task.alidantech.org       Cloud API client
```

The local application and hosted website are separate application boundaries. The local application talks to local workspace operations. The hosted website and mobile talk directly to the hosted API. The CLI can later use the sync client to connect local files to Task Cloud.

## 7. Local CLI and application interaction

The CLI remains useful independently of the local application. Ordinary commands invoke workspace operations directly; they do not require an HTTP server.

A command such as:

```bash
task run
```

performs this flow:

1. Discover and validate the selected workspace.
2. Start or manage the local application for that workspace.
3. Bind the local service to loopback by default.
4. Serve the browser dashboard and restricted local HTTP API.
5. Expose a WebSocket for local change notifications.
6. Open the dashboard or print its local URL.

Dashboard operations call the local HTTP API. CLI commands use the same workspace operations directly. Changes from CLI, dashboard, agents, or external editors are reconciled and broadcast to connected dashboard clients.

The first implementation may run in the foreground and stop with the CLI process. Background operation is a later convenience. Stopping the server does not affect workspace files or direct CLI commands.

## 8. Local security and reliability

- Bind to loopback by default; LAN exposure requires a separately designed and secured opt-in.
- Validate browser origins and protect local endpoints against cross-origin request abuse.
- Use a per-runtime capability/token or equivalent for sensitive operations and WebSocket subscriptions.
- Restrict all operations to the selected workspace and explicitly permitted paths.
- Never expose arbitrary filesystem operations, shell execution, or credential access through the local API.
- Treat filesystem watcher events as hints and reconcile against actual files.
- Support WebSocket reconnect and fresh snapshot/cursor recovery.
- Keep local WebSocket events separate from durable cloud sync changes.
- Local CLI operations must remain available when the local application is stopped or fails.

## 9. File-based local persistence and Git

- Markdown/YAML and other supported workspace files are the authoritative local records.
- Root `task.yaml` configures the workspace and selects the managed content boundary.
- The default managed folder is `tasks/`; alternatives such as `.tasks/` or `.docs/` may be configured.
- Task frontmatter requirements apply only inside the configured managed boundary. Ordinary Markdown outside it remains ordinary Markdown.
- Task must not rewrite unrelated project files.
- Git is optional. A workspace may be inside a Git repository or may be a normal directory.
- When Git is present, Task should coexist with user-managed Git history and operations.
- Git and Task Cloud sync are independent mechanisms.
- Derived indexes/caches may be used when justified, but must not become a competing authoritative store for local records.
- Credentials and cloud tokens must not be stored in workspace Markdown or committed configuration.

## 10. Cloud API and identity

The hosted API is a standalone NestJS project under `source/api/`, initially a modular monolith. Its public domain is `task-api.alidantech.org`.

The hosted website is deployed at `task.alidantech.org` and communicates directly with the API. OAuth is the intended sign-in direction; provider, exact flow, session lifecycle, and credential handling remain implementation decisions. Local-only use never requires authentication.

Conceptual internal API modules include:

| Module | Responsibility |
| --- | --- |
| Identity | Accounts, profiles, authentication integration and sessions |
| Organisations | Organisation lifecycle, memberships, invitations and roles |
| Workspaces | Ownership, settings, workspace mode and connections |
| Projects | Project metadata, lifecycle and workspace relationships |
| Tasks | Task records, status, priority, assignment and scheduling |
| Documents | Markdown content, frontmatter, document types and decisions |
| Relationships | Dependencies, hierarchy and cross-record links |
| Authorization | Workspace access checks and permission enforcement |
| Synchronization | Replica registration, revisions, change exchange and conflicts |
| Search | Authorised search and cross-project aggregation |
| Activity | Comments, change history and audit events |
| Notifications | Mentions, assignment updates, reminders and preferences |
| Integrations | Git providers and future external services |

These are internal modules of one API application, not separate deployable services by default. The API enforces authorization and tenant isolation on every protected operation.

## 11. Two-way multi-device synchronization

Synchronization is a dedicated subsystem. It is not a file-copy command, background upload hidden inside document CRUD, or an extension of the local WebSocket.

### Required concepts

- Stable workspace and record identifiers independent of filenames and paths.
- A cloud workspace connection and per-device/local-replica identity.
- Per-replica sync progress and durable change cursors.
- Record revisions and an incremental change representation.
- Idempotency keys and retryable operations.
- Explicit deletion/tombstone semantics.
- Divergence detection and conflict preservation.
- Initial reconciliation with explicit user confirmation.
- Offline change discovery/queueing and interrupted-session recovery.
- Permission revocation, unlinking and secure credential lifecycle.
- Schema compatibility and migration handling.

### Target flow

1. The user signs in through an authorised cloud client and explicitly links a local workspace to a cloud workspace.
2. Task verifies access to the cloud workspace and inspects local and remote content.
3. Task presents the initial reconciliation plan; the user confirms before destructive or ambiguous changes.
4. The local replica is registered with its own device identity and sync cursor.
5. Local changes are detected and queued; remote changes are fetched for local application.
6. Each operation is validated against shared workspace rules and cloud authorisation.
7. Safe, non-conflicting changes are applied and acknowledged.
8. Divergent changes are preserved and presented for explicit resolution.
9. Retries and reconnects resume safely without duplicating mutations or losing progress.

Multiple computers can independently edit while offline. The cloud service tracks progress per replica so one device's successful sync does not imply that every other device has received the changes.

### Conflict and authority policy

Do not assume a universal winner. Git is responsible for repository history and branch operations; Task Cloud is authoritative for cloud-native workspaces. For connected workspaces, authority and merge behavior must be specified for the relevant records and operations. Never silently choose the newest timestamp, local copy, cloud copy, or Git branch as the winner.

## 12. Flutter mobile

The mobile application is planned in Flutter and connects directly to the hosted API. It does not require a local computer or local runtime to be online.

Initial mobile workflows should focus on authenticated workspace access, My Work, task details and supported edits, project browsing, notifications, and visible sync state. Exact offline scope, push delivery, attachment behavior, and local caching remain to be designed.

## 13. TUI

The TUI is a future keyboard-driven terminal application for people. It complements the CLI's scriptable and agent-facing interface. It must reuse the same workspace operations and validation rules and must not create a competing task model.

Begin with local workspace workflows. Add authenticated cloud workflows only through established API and sync contracts.

## 14. Implementation sequence

### Local product — first priority

1. **Workspace and CLI foundations:** define `task.yaml`, workspace discovery, managed-folder boundaries, file/document contracts, stable IDs, and useful CLI commands.
2. **Workspace operations:** implement shared task/document reads, writes, listing, validation, and safe file operations.
3. **Local runtime:** implement local HTTP API, WebSocket, file watching/reconciliation, security, and snapshot/reconnect behavior under `apps/local/`.
4. **Local dashboard:** implement the browser interface against the local runtime.
5. **Integration and reliability:** verify CLI/dashboard changes in both directions, external editor changes, offline behavior, safe writes, and recovery.

### Cloud platform — after local product

6. **Cloud contracts:** define identity, ownership, organisations, authorization, cloud persistence, and API contracts.
7. **Hosted API and website:** implement the NestJS modular monolith and hosted website at the agreed domains; add OAuth.
8. **Synchronization:** design and implement two-way multi-device sync, then add CLI login/link/sync commands.
9. **Flutter mobile:** implement the cloud client against stable API contracts.
10. **TUI:** add the interactive terminal interface using established workspace operations.

Do not make the local product wait for cloud infrastructure. Do not implement the sync engine before the local workspace identity and file-operation foundations are stable.

## 15. Deferred decisions

- Exact `task.yaml` schema and workspace discovery precedence.
- Full document schemas, stable ID format and clone/fork identity semantics.
- Local runtime framework, port discovery, process lifecycle, HTTP routes and WebSocket event schema.
- UI frameworks and the exact amount of component/design-system sharing between local and hosted applications.
- OAuth provider, sign-in flows, session/token lifecycle and account recovery.
- Organisation roles, permission matrix, invitations and ownership transfer.
- Cloud database, storage, hosting and deployment details.
- Markdown/file-to-cloud record mapping and cloud-native export format.
- Sync transport, revision representation, cursors, ordering, retries and offline guarantees.
- Conflict resolution UI, automatic merge cases, tombstone retention and garbage collection.
- Flutter offline scope, notifications, attachments and caching.
- TUI framework and interaction model.
- API versioning and generated client strategy.
- Billing, quotas, retention, privacy and data residency.

These decisions must be designed before the corresponding implementation depends on them.

## Current implementation status

Only `source/apps/cli/` is scaffolded. The local application, hosted NestJS API, hosted website, Flutter mobile app, and TUI are not implemented. The intended tree is not a claim that these applications already exist.
