---
id: TASK-WORKSPACE-README
name: Task workspace guide
type: workspace-guide
---

# Task workspace

This directory is the repository's own Task-managed workspace (dogfooding). It demonstrates the visible workspace convention that `task init` should create in other projects.

Use it for work and project context that the Task tool manages:

- Task records as individual Markdown files with stable IDs.
- Engineering documentation under `docs/`, product requirements, research, and project notes under `docs/`.
- Architecture and product decisions under `decisions/`.
- Agent and contributor handoffs under `handoffs/`.
- Project agent profiles under `agents/` and reusable project rules under `rules/`.
- Small, explicitly managed workspace state under `state/`.
- Completed task groups under `todo/_archive/YYYY/MM/YYYY-MM-DD-<group-slug>/`.

A possible shape as records are added:

```text
tasks/
├── README.md
├── config.yaml
├── TASK-0001.md
├── docs/
│   ├── product/
│   ├── research/
│   └── benchmarks/
├── decisions/
├── agents/
│   └── templates/          # Optional project-specific Handlebars overrides
├── handoffs/
├── rules/
├── state/
└── todo/
    └── _archive/
        └── YYYY/MM/YYYY-MM-DD-<group-slug>/
```

Create these areas as real records are added; do not add empty placeholders. This is a new workspace layout: archive operations use `todo/_archive/` exclusively and intentionally do not read or migrate a workspace-root `archive/` directory.

## Markdown frontmatter

Every Markdown file in the managed workspace, including engineering documentation in `docs/`, must start with YAML frontmatter delimited by `---`, including documentation, research, handoffs, decisions, and task records.

The metadata contract is strict and extensible:

- Common required fields: `id`, `name`, and `type`.
- Type-specific schemas define the fields and constraints for each document type.
- `tags` is a structured sequence of strings for categorisation and filtering.
- `extra` is an explicit mapping for supplemental data that does not belong to the common or type-specific schema.
- Unknown top-level fields are invalid unless declared by the applicable schema or a supported workspace extension.

The repository-level `task.yaml` configures Task and selects the managed workspace. It is not the frontmatter block inside each Markdown file.

The frontmatter is the machine-readable contract used by validation and the Task UI. The Markdown body contains the human-readable document. See [Markdown metadata and schema architecture](docs/architecture/markdown-metadata-schema.md) and [Decision 0003](decisions/0003-structured-frontmatter-schema.md).

## Source of truth

- Individual records in this workspace are authoritative.
- Root `TODO.md` is a convenient overview/index and should not become a competing task database.
- Keep links between related tasks, documents, and decisions explicit.
- The eventual CLI, dashboard, and terminal interface must operate on this same workspace and shared domain rules. Engineering docs in `docs/` are discoverable workspace documents; root repository Markdown remains outside this contract.
