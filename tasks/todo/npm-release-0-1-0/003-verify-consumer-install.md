---
{id: TSK-NPM-CONSUMER-010,name: Verify CLI from a clean consumer installation,type: task,status: planned,priority: high,created_at: 2026-10-31,updated_at: 2026-11-01T01:04:54.908Z,tags: [release,npm,verification],extra: {group_id: GRP-NPM-RELEASE-010,status_history: [{from: planned,to: in-progress,at: 2026-10-31T21:06:32.213Z},{from: in-progress,to: planned,at: 2026-11-01T01:04:54.908Z}]},due_at: 2026-11-12}
---

# Verify CLI from a clean consumer installation

## Goal

Prove the release candidate works after installation in a clean directory that has no monorepo links or undeclared dependencies.

## Acceptance criteria

- Pack the release candidate and install it in a fresh temporary consumer project using the supported package manager/runtime.
- Exercise `taskcode`, `task`, and `tc`, version/help, workspace discovery/init, representative task and document operations, validation, JSON output, non-interactive use, and expected exit codes.
- Exercise the release-scope TUI and `task run` dashboard/runtime flows where supported, including asset resolution and clean shutdown.
- Verify global installation and invocation from a different working directory if global installation is supported.
- Record commands, results, supported platform/runtime matrix, and fixed issues in a release checklist; all required checks pass before publication.

## Dependencies

- TSK-NPM-CLI-SCOPE-010
- TSK-NPM-PACKAGE-010
