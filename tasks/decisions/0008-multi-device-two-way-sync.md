---
id: DEC-0008
name: Two-way multi-device workspace synchronization
type: decision
status: accepted
created_at: 2026-10-31
---

# Decision 0008: Two-way multi-device workspace synchronization

- **Status:** Accepted
- **Date:** 2026-10-31
- **Scope:** Future Task Cloud synchronization for connected local workspaces and cloud-native workspaces

## Context

A connected workspace must be usable from more than one computer. Each computer may have its own local copy and may work while offline. Changes can occur independently on multiple devices and in hosted clients. Synchronization must reconcile these changes without silently losing work.

## Decisions

1. **Support two-way synchronization.** Changes can flow from local workspaces to Task Cloud and from Task Cloud to connected local workspaces.
2. **Support multiple local replicas of one cloud workspace.** A cloud workspace may be connected to local workspaces on multiple computers. Each local installation/replica has its own registered device or client identity and sync progress.
3. **Keep local replicas independently usable offline.** A disconnected device can continue supported local work. Changes are queued or discovered for later reconciliation when connectivity returns.
4. **Do not equate a device, user, local directory, Git clone, and cloud workspace.** They are distinct identities. The exact registration and clone/fork rules must be defined in the sync protocol.
5. **Use stable workspace and record identifiers.** IDs must survive ordinary edits and moves and must not rely solely on file paths or filenames. Clone/fork semantics must prevent accidental identity collisions.
6. **Track revisions and incremental progress.** The protocol must represent record revisions and a durable workspace-level change cursor or equivalent so clients can exchange incremental changes and recover after interruption.
7. **Make operations idempotent and retryable.** Repeating a sync request must not duplicate mutations. Clients must be able to retry after network loss or process interruption.
8. **Represent deletions explicitly.** Deletion/tombstone information must persist long enough for every authorised replica to observe and reconcile it. A missing file alone is not sufficient evidence for safe deletion propagation.
9. **Detect divergence and expose conflicts.** If local and cloud changes cannot be safely reconciled, preserve both versions and surface the conflict for an explicit resolution. Never silently choose local, cloud, newest timestamp, or Git as a universal winner.
10. **Validate changes consistently.** Local and remote changes must respect the shared workspace/document contracts and applicable cloud authorization. Permission revocation and workspace access changes must be handled during sync.
11. **Keep synchronization separate from local live updates and Git.** WebSocket is for local dashboard updates; Git is for repository history and branch workflows; Task sync is for exchanging workspace changes with the hosted service.
12. **Make initial linking/reconciliation explicit.** Before the first sync, identify the local workspace and cloud workspace, inspect their contents, present the reconciliation outcome, and require confirmation before potentially destructive application.
13. **Expose sync state and recovery.** Users must be able to understand last successful sync, pending work, failures, conflicts, and recovery actions.
14. **Design for multiple writers.** The protocol must account for changes from multiple local devices and hosted website/mobile clients, including devices that remain offline for extended periods.
15. **Do not implement the sync engine as part of the initial local milestone.** The local product should establish stable identities and safe file operations where appropriate, while the complete sync protocol and engine are designed and implemented in a later cloud phase.

## Conceptual topology

```text
Local replica A  <----->  Task Cloud workspace  <----->  Local replica B
       ^                          ^                           ^
       |                          |                           |
   Device A                  Hosted clients                Device B
                              (web/mobile)

Each local replica has independent local files, device identity, and sync progress.
The cloud workspace mediates authorised change exchange; it is not a reason to
make local files unavailable when offline.
```

## Required protocol capabilities

The later sync design must specify:

- Workspace connection and replica registration.
- Stable workspace, record, and device/client identifiers.
- Change representation, revision model, ordering, and cursors.
- Initial reconciliation and subsequent incremental sync.
- Idempotency, retries, backoff, and interrupted-session recovery.
- Tombstones and deletion retention/acknowledgement.
- Concurrent edit detection and conflict presentation/resolution.
- Rename/move handling and file-to-record mapping.
- Schema/version compatibility and migration behavior.
- Permission changes, unlinking, revocation, and secure credential handling.
- Sync status, auditability, observability, and user-initiated recovery.

## Consequences

- Sync cannot be implemented as a simple one-way upload or file-copy operation.
- The cloud service must track per-replica progress and preserve changes long enough for offline devices to catch up.
- The protocol must tolerate multiple concurrent writers and extended offline periods.
- Local file authority and cloud collaboration must be reconciled through explicit rules rather than implicit last-write-wins behavior.
- The initial local product can be delivered independently, provided it does not undermine stable identity, file integrity, or future change tracking.

## Deferred decisions

- Exact sync transport and API endpoints.
- Revision representation: per-record versions, operation log, content hashes, or a combination.
- Conflict resolution UI and supported automatic merge cases.
- Device registration, trust, revocation, and credential lifecycle.
- Clone/fork identity behavior and workspace linking constraints.
- Tombstone retention and garbage collection.
- Ordering/causality guarantees and concurrent operation semantics.
- Cloud persistence engine, event storage, and operational scaling.
- Which document/file types are synchronisable and how binary attachments are handled.

These details require a dedicated protocol design before sync implementation begins.
