---
{id: TSK-NPM-CLI-SCOPE-010,name: Define the complete CLI release scope,type: task,status: in-progress,priority: high,created_at: 2026-10-31,updated_at: 2026-10-31T03:45:28.757Z,tags: [release,npm,cli],extra: {group_id: GRP-NPM-RELEASE-010,status_history: [{from: planned,to: in-progress,at: 2026-10-31T03:45:28.757Z}]}}
---

# Define the complete CLI release scope

## Goal

Specify what “everything is in the CLI correctly” means for the `0.1.0` npm release, so installed users can use the intended Task workflows from one `taskcode` package with `task` and `tc` aliases.

## Acceptance criteria

- Inventory user-facing capabilities across the CLI, TUI, local dashboard/runtime, and shared packages; identify which must work through the installed CLI at `0.1.0`.
- Document supported operating systems and required runtimes, including Bun and Node.js requirements, with a reason for each requirement.
- Verify that `taskcode`, `task`, and `tc`, interactive use, non-interactive use, JSON output, stable exits, `task init`, `task run`, and TUI invocation have clear release expectations.
- Record unresolved decisions and any explicitly deferred capabilities in a project decision or release document before implementation depends on them.

## Dependencies

None.
