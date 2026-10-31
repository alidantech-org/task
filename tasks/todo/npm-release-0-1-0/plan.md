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

The CLI package is being prepared as unscoped `tasknode@0.1.0`, with `tasknode`, `task`, and `tk` executable aliases. Exact-name npm lookup returned not found, but npm's similarity check can only be confirmed by publishing the genuine package. The release must not be published until the package build and clean consumer checks pass. The current implementation requires Bun 1.3.14 or later; npm, pnpm, and Bun are install choices, not interchangeable runtimes. Registry ownership/access and credentials must be confirmed as part of the final publication action.
