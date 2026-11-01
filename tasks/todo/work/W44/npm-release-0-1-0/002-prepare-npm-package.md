---
{id: TSK-NPM-PACKAGE-010,name: Prepare the npm package for standalone installation,type: task,status: completed,priority: high,created_at: 2026-10-31,updated_at: 2026-11-01T02:52:01.670Z,tags: [release,npm,packaging],extra: {group_id: GRP-NPM-RELEASE-010,status_history: [{from: planned,to: in-progress,at: 2026-10-31T21:00:04.552Z},{from: in-progress,to: blocked,at: 2026-10-31T21:06:55.246Z},{from: blocked,to: completed,at: 2026-10-31T21:06:58.072Z},{from: completed,to: blocked,at: 2026-11-01T00:40:43.467Z},{from: blocked,to: planned,at: 2026-11-01T01:05:05.899Z},{from: planned,to: completed,at: 2026-11-01T02:52:01.670Z}]},due_at: 2026-11-14}
---

# Prepare the npm package for standalone installation

## Goal

Ensure `taskcode@0.1.0` contains or resolves every required package and runtime asset when installed outside this monorepo.

## Acceptance criteria

- Inspect the package tarball contents, generated entry points, `taskcode`/`task`/`tc` binaries, license/readme metadata, dependency declarations, and package install lifecycle.
- Bundle same-workspace `@task/*` code into the CLI artifact so a normal npm install does not require unpublished workspace packages.
- Ensure dashboard assets/runtime and TUI assets work from a global or project install, or document explicitly scoped functionality according to the accepted release scope.
- Check platform/runtime assumptions and make package scripts safe for supported consumer installation environments.
- Update package and installation documentation with verified commands and compatibility requirements.
- Select the project license and include its license file before adding license metadata to the package.

## Dependencies

- TSK-NPM-CLI-SCOPE-010
