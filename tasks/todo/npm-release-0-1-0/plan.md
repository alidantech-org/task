---
id: GRP-NPM-RELEASE-010
name: npm release 0.1.0
type: documentation
tags:
  - release
  - npm
  - cli
---

# npm release 0.1.0

## Goal

Prepare Task for a reliable public npm release at version `0.1.0`, with the installed CLI providing the complete documented command-line experience and bundling or correctly depending on all required runtime components.

## Scope

- Decide which capabilities belong in the installed CLI and record any product decisions that publication depends on.
- Make package contents, dependency topology, runtime requirements, executable aliases, and installation instructions work for npm consumers.
- Verify the packed package from a clean consumer project and confirm key CLI workflows, JSON/script behavior, and dashboard/TUI entry points.
- Publish version `0.1.0`, document the release, and check the published package and install path.

## Notes

The repository currently declares `@task/cli` at `0.1.0` and has package and install smoke scripts. Confirm package identity, scoped name, ownership/access, and npm credentials before publication; do not publish until release readiness and consumer installation checks pass.
