---
id: TSK-NPM-CONSUMER-010
name: Verify CLI from a clean consumer installation
type: task
status: planned
priority: high
created_at: 2026-10-31
updated_at: 2026-10-31
tags:
  - release
  - npm
  - verification
extra:
  group_id: GRP-NPM-RELEASE-010
---

# Verify CLI from a clean consumer installation

## Goal

Prove the release candidate works after installation in a clean directory that has no monorepo links or undeclared dependencies.

## Acceptance criteria

- Pack the release candidate and install it in a fresh temporary consumer project using the supported package manager/runtime.
- Exercise both `task` and `tk`, version/help, workspace discovery/init, representative task and document operations, validation, JSON output, non-interactive use, and expected exit codes.
- Exercise the release-scope TUI and `task run` dashboard/runtime flows where supported, including asset resolution and clean shutdown.
- Verify global installation and invocation from a different working directory if global installation is supported.
- Record commands, results, supported platform/runtime matrix, and fixed issues in a release checklist; all required checks pass before publication.

## Dependencies

- TSK-NPM-CLI-SCOPE-010
- TSK-NPM-PACKAGE-010
