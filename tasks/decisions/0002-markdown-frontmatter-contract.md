---
id: DEC-0002
name: Markdown frontmatter is required for every document
type: decision
status: accepted
created_at: 2026-10-31
---

# Decision 0002: Markdown frontmatter is required for every document

- **Status:** Accepted
- **Date:** 2026-10-31
- **Scope:** Task-managed workspaces, repository documentation, validation, and the local web UI

## Context

Task uses Markdown as its human-readable document format. The CLI, dashboard, and terminal interface need a reliable way to discover, classify, validate, navigate, and present Markdown documents without relying on folder names or parsing headings to guess what a file represents.

This requirement applies to documentation as much as it applies to task records and decisions. A documentation file is still a structured Task document.

## Decisions

1. Every Markdown file managed by Task must begin with a YAML frontmatter block delimited by `---`.
2. Frontmatter is required for all document categories, including documentation, guides, research, handoffs, task records, projects, and decisions.
3. The common metadata contract starts with required `id`, `name`, and `type` fields. Type-specific schemas may require additional fields.
4. The YAML frontmatter is the machine-readable document contract. The Markdown body is the human-readable content.
5. `task validate` and `tk validate` must discover and validate all in-scope Markdown files, including documentation. Missing or malformed frontmatter and schema violations are validation errors.
6. Validation should report the file path and actionable field/line details. Identifier uniqueness and semantic/reference checks belong in validation where the relevant schemas define them.
7. The local web application started by `task run` (for example, `task run -p 3004`) must use this metadata to discover and present documents. It should be able to build document navigation, listings, filters, and document pages from the workspace rather than maintaining a separate manual registry.
8. CLI, dashboard, and terminal interfaces must share the same document schemas and interpretation rules.

## Consequences

- Existing Markdown files in the Task repository and future Task-managed workspaces must follow the frontmatter convention.
- New Markdown documents must include frontmatter from creation.
- The validator and UI must use the same schema definitions; they must not independently invent document types or required fields.
- Workspace discovery must define explicit exclusions for generated or third-party Markdown rather than silently ignoring files.
- The complete type-specific schemas, field types, allowed values, relationship rules, and exclusion configuration remain to be designed before implementing validation.

## Example

```markdown
---
id: TASK-0001
name: Define the workspace document schema
type: task
status: planned
created_at: 2026-10-31
---

# Define the workspace document schema

Document content goes here.
```

The example illustrates the format; the final task-specific fields and allowed values are governed by the schemas that will be designed separately.
