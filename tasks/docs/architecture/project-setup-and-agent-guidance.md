---
id: DOC-PROJECT-SETUP-AGENT-GUIDANCE
name: Project setup and agent guidance
type: documentation
tags:
  - architecture
  - agents
  - setup
---

# Project setup and agent guidance

`task project inspect` reads repository files and reports evidence-backed facts and optional recommendations. `task setup` presents those findings, lets a user select Task workspace documents and rules, previews native agent-tool outputs, and asks before writing. Inspection and planning are read-only. The inspector does not execute scripts, install dependencies, or call external services.

## Sources and generated adapters

The configured Task workspace is authoritative. Project-specific agent profiles belong under `agents/`, rules under `rules/`, and documentation under `docs/`; every Markdown file there uses the shared Task frontmatter contract. Optional Handlebars overrides live under `agents/templates/`.

Root or tool-specific guidance files are adapters for clients that expect those paths. The setup flow supports Codex `AGENTS.md`, Claude Code `CLAUDE.md`, GitHub Copilot instructions, Cursor `.mdc` rules, and portable Agent Skills in `.agents/skills/`. Each output follows its client file shape. Managed sections preserve surrounding README and guidance text. Existing unmarked create-only targets are conflicts and are not overwritten.

The setup plan can be emitted as JSON for review and later applied explicitly:

```sh
task project inspect --json
task setup plan --json --docs repository-map --rules coding,testing --agents codex,cursor
task setup apply --path ./setup-plan.json
```

The plan is constrained to the selected project's approved guidance paths and the configured Task workspace. Symlinked output path components are rejected. This is safe path preflight, not a claim of race-safe operations against hostile concurrent filesystem changes.

Git choices describe agent behavior only. Setup does not modify Git configuration, install hooks, or commit changes. This release prepares guidance and Skills; agent execution and orchestration are not implemented. The local browser does not receive workspace content through this feature.

## Completed and archived work

When every task in a group is completed, the group moves to `todo/_completed/YYYY/MM/YYYY-MM-DD-<slug>/`. Explicitly archived tasks and groups (which may contain incomplete work) move to `todo/_archived/YYYY/MM/YYYY-MM-DD-<slug>/`. Task IDs and metadata remain stable. Individual task archives retain their original path in `extra.archived_from` so restore can return them to the prior group.

Project setup should present a choice to commit these records or ignore one or both folders in `.gitignore`. Committing preserves portable history with the project. Ignoring keeps local history out of version control. Do not select or apply either choice silently; setup can recommend an option based on project conventions and ask the user. Existing `todo/_archive/` paths are read as legacy archive data while new archive operations use `todo/_archived/`.
