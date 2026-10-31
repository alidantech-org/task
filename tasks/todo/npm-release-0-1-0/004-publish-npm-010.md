---
id: TSK-NPM-PUBLISH-010
name: Publish npm release 0.1.0
type: task
status: planned
priority: high
created_at: 2026-10-31
updated_at: 2026-10-31
tags:
  - release
  - npm
extra:
  group_id: GRP-NPM-RELEASE-010
---

# Publish npm release 0.1.0

## Goal

Publish the verified public CLI package as version `0.1.0` and confirm that consumers can install and use the published artifact.

## Acceptance criteria

- Confirm final package name, public access, npm ownership, version, repository metadata, release notes, and clean committed source state.
- Run the documented release readiness and clean-consumer installation checks from the release checklist.
- Publish only artifacts whose package dependencies are already publicly available in the documented order.
- Install `@task/cli@0.1.0` from the public registry in a clean environment and verify `task --version`, `task --help`, and core release-scope workflows.
- Record the registry version, publication date, verification outcome, and any known limitations in release documentation.

## Dependencies

- TSK-NPM-PACKAGE-010
- TSK-NPM-CONSUMER-010
