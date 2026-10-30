---
id: DEC-0002
name: Frontmatter applies only inside the configured Task workspace
type: decision
status: accepted
created_at: 2026-10-31
---

# Decision 0002: Frontmatter applies only inside the configured Task workspace

- **Status:** Accepted
- **Date:** 2026-10-31
- **Scope:** Task-managed workspace, validation, and local web UI

## Context

Task needs structured metadata for the Markdown documents it manages so the CLI and web UI can discover, classify, validate, navigate, and present those documents. However, repositories also contain ordinary Markdown files that are not Task records, such as a root `README.md`, `AGENTS.md`, or engineering documentation.

Requiring Task metadata in every Markdown file across the repository would impose Task-specific rules on unrelated documentation and common repository files.

## Decisions

1. YAML frontmatter is mandatory for every Markdown file **inside the configured Task-managed workspace**.
2. Markdown files outside that workspace are ordinary repository Markdown and do not require Task frontmatter.
3. The Task-managed workspace defaults to the `tasks/` directory when no `task.yaml` configuration file or workspace setting is present.
4. A repository may configure a different workspace directory in `task.yaml`, such as `tasks/docs/` or `.tasks/`. When selected, that directory becomes the managed boundary and all Markdown files inside it require frontmatter.
5. The common metadata contract begins with required `id`, `name`, and `type` fields. Type-specific schemas may require additional fields.
6. The YAML frontmatter is the machine-readable document contract. The Markdown body is the human-readable content.
7. `task validate` and `tk validate` must discover and validate every in-scope Markdown file inside the configured workspace. Missing or malformed frontmatter and schema violations are errors. They must not impose this rule on unrelated Markdown outside the workspace.
8. Validation should report the file path and actionable field/line details. Identifier uniqueness and semantic/reference checks belong in validation where the relevant schemas define them.
9. The local web application started by `task run` (for example, `task run -p 3004`) must discover and present documents from the configured workspace using their metadata. It should build navigation, listings, filters, and document pages from that workspace rather than maintaining a separate manual registry.
10. CLI, dashboard, and terminal interfaces must share the same schema definitions and interpretation rules.

## Consequences

- New Markdown files inside the managed workspace must include frontmatter from creation.
- Ordinary Markdown outside the managed workspace remains unaffected.
- The validator and UI must use the same schema definitions; they must not independently invent document types or required fields.
- Workspace discovery must define explicit exclusions for generated or third-party Markdown found inside the managed workspace rather than silently ignoring files.
- The exact `task.yaml` configuration key, complete type-specific schemas, field types, allowed values, relationship rules, and exclusion configuration remain to be designed before implementation.

## Example

A repository with no `task.yaml` uses:

```text
repository/
├── README.md             # ordinary Markdown; no Task frontmatter required
├── AGENTS.md             # ordinary Markdown; no Task frontmatter required
└── tasks/                # default Task-managed workspace
    ├── README.md         # Task frontmatter required
    ├── TASK-0001.md      # Task frontmatter required
    └── decisions/
        └── DEC-0001.md   # Task frontmatter required
```

A repository may instead configure `tasks/docs/` or `.tasks/` as its managed workspace. In that case, Markdown inside the selected directory follows the frontmatter contract.
