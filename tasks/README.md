---
id: TASK-WORKSPACE-README
name: Task workspace guide
type: workspace-guide
---

# Task workspace

This directory is the repository's own Task-managed workspace (dogfooding). It demonstrates the visible workspace convention that `task init` should create in other projects.

Use it for work and project context that the Task tool manages:

- Task records as individual Markdown files with stable IDs.
- Product requirements, research, and project notes under `docs/`.
- Architecture and product decisions under `decisions/`.
- Agent and contributor handoffs under `handoffs/`.
- Small, explicitly managed workspace state under `state/`.
- Historical records under `archive/` and completed-task organization as the lifecycle is defined.

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
├── handoffs/
├── state/
└── archive/
```

Do not create empty folders just to match this illustration. Add structure as the product's workspace model and real records require it.

## Markdown frontmatter is mandatory

Every Markdown file in the managed workspace must start with YAML frontmatter delimited by `---`, including documentation, research, handoffs, decisions, and task records. The common required fields are `id`, `name`, and `type`; type-specific schemas may require additional metadata.

The frontmatter is the machine-readable contract used by validation and the Task UI. The Markdown body contains the human-readable document.

## Source of truth

- Individual records in this workspace are authoritative.
- Root `TODO.md` is a convenient overview/index and should not become a competing task database.
- Keep links between related tasks, documents, and decisions explicit.
- The eventual CLI, dashboard, and terminal interface must operate on this same workspace and shared domain rules.
