---
id: TSK-NPM-PACKAGE-010
name: Prepare the npm package for standalone installation
type: task
status: planned
priority: high
created_at: 2026-10-31
updated_at: 2026-10-31
tags:
  - release
  - npm
  - packaging
extra:
  group_id: GRP-NPM-RELEASE-010
---

# Prepare the npm package for standalone installation

## Goal

Ensure `@task/cli@0.1.0` contains or resolves every required package and runtime asset when installed outside this monorepo.

## Acceptance criteria

- Inspect the package tarball contents, generated entry points, `task`/`tk` binaries, license/readme metadata, dependency declarations, and package install lifecycle.
- Resolve same-workspace `@task/*` dependencies so a normal npm install does not require unpublished or private workspace state; publish supporting public packages in a documented order if they remain separate.
- Ensure dashboard assets/runtime and TUI assets work from a global or project install, or document explicitly scoped functionality according to the accepted release scope.
- Check platform/runtime assumptions and make package scripts safe for supported consumer installation environments.
- Update package and installation documentation with verified commands and compatibility requirements.

## Dependencies

- TSK-NPM-CLI-SCOPE-010
