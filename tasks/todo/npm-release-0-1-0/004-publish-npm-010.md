---
{id: TSK-NPM-PUBLISH-010,name: Publish npm release 0.1.0,type: task,status: planned,priority: high,created_at: 2026-10-31,updated_at: 2026-11-01T01:04:52.801Z,tags: [release,npm],extra: {group_id: GRP-NPM-RELEASE-010,status_history: [{from: planned,to: blocked,at: 2026-10-31T21:00:06.951Z},{from: blocked,to: in-progress,at: 2026-10-31T21:06:33.819Z},{from: in-progress,to: planned,at: 2026-11-01T01:04:52.801Z}]},due_at: 2026-11-05}
---

# Publish npm release 0.1.0

## Goal

Publish the verified public `taskcode` CLI package as version `0.1.0` and confirm that consumers can install and use the published artifact.

## Acceptance criteria

- Confirm package name `taskcode`, public access, npm ownership, version, repository metadata, release notes, and clean committed source state.
- Confirm the project's license and include its text in the package before publication.
- Run the documented release readiness and clean-consumer installation checks from the release checklist.
- Publish the self-contained CLI package after its dependencies and assets have been verified from a clean consumer install.
- Install `taskcode@0.1.0` from the public registry in a clean environment and verify `taskcode`, `task`, and `tc` version/help and core release-scope workflows.
- Record the registry version, publication date, verification outcome, and any known limitations in release documentation.

## Dependencies

- TSK-NPM-PACKAGE-010
- TSK-NPM-CONSUMER-010
