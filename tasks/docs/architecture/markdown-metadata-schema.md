---
id: DOC-ARCHITECTURE-MARKDOWN-METADATA-SCHEMA
name: Markdown Metadata Schema
type: documentation
tags:
  - engineering
---

# Markdown metadata and schema architecture

This document defines the accepted design direction for metadata in Task-managed Markdown. It is a contract-design document; it does not claim that parsing, schemas, or validation have been implemented.

## 1. Two different YAML roles

Task uses YAML in two separate places:

| Location | Purpose |
| --- | --- |
| Repository-root `task.yaml` | Configures Task for the repository, including which directory is the Task-managed workspace |
| YAML frontmatter at the top of a managed Markdown file | Stores structured metadata for that individual document |

The repository configuration is not copied into each Markdown file. Document frontmatter is delimited by `---` at the beginning of the file.

## 2. Scope

The frontmatter requirement applies only to Markdown files inside the configured Task-managed workspace.

- The default workspace is `tasks/` when no configuration or workspace setting selects another directory.
- `task.yaml` may select `.tasks/`, `tasks/docs/`, or another repository-relative directory.
- Every Markdown file inside the selected workspace follows the metadata contract.
- Markdown outside the selected workspace, including root `README.md`, root `AGENTS.md`, while engineering documentation under `tasks/docs/` is managed and requires frontmatter.

See [Decision 0002](../../tasks/decisions/0002-markdown-frontmatter-contract.md).

## 3. Metadata contract

The schema system has four layers:

1. **Common identity fields:** required fields shared by every managed document: `id`, `name`, and `type`.
2. **Common optional metadata:** reusable metadata fields that may apply across document types. The final list and constraints remain to be designed.
3. **Type-specific metadata:** fields defined by the schema selected by `type`. Each type defines its own required and optional fields, data types, allowed values, and semantic constraints.
4. **Explicit extension metadata:** the `extra` mapping for supplemental information that is not part of the common or type-specific contract.

The contract is strict at the top level: an unknown field is an error unless the active schema or a supported workspace extension explicitly declares it. The `extra` mapping is the intentional extension point; it is not permission to add arbitrary top-level keys or bypass validation.

## 4. Tags

`tags` is a first-class optional metadata field represented as a YAML sequence of strings:

```yaml
tags:
  - architecture
  - metadata
  - developer-experience
```

The schema must validate that tags are a sequence of valid strings and must make them consistently available to search, filtering, grouping, and UI facets. Duplicate handling, case sensitivity, normalization, and exact naming constraints remain open schema-design decisions.

## 5. Extra information

`extra` is an optional mapping for supplementary metadata:

```yaml
extra:
  source: product-planning
  review:
    required: true
    audience:
      - maintainers
  references:
    issue: TASK-0042
```

Requirements:

- It is a mapping/object, not an unstructured text blob.
- Values are data only and use safe YAML-compatible scalar, sequence, and mapping values.
- It cannot override or shadow common or type-specific fields.
- It does not disable validation of known metadata.
- Parser safety, nesting depth, size limits, and any namespace conventions must be defined before implementation.

If a field becomes important to core behavior, filtering, relationships, or interoperability, it should graduate into a common or type-specific schema field rather than remain hidden in `extra`.

## 6. Type-specific schemas

The `type` field selects a schema. A type schema defines:

- Type identifier and human-readable name.
- Required and optional fields.
- Field data types and constraints.
- Enumerated values where applicable.
- Defaults, if any, with explicit semantics.
- Relationships and reference rules.
- Fields available to search, filters, sorting, and UI presentation.

Examples of potential document types include tasks, projects, decisions, handoffs, research, specifications, meeting notes, and milestones. This list is illustrative, not a finalized type catalogue.

A task schema may define status, priority, assignee, due date, estimate, parent, and dependencies. A decision schema may define status, date, scope, and decision references. Fields should not be assumed to apply to every type.

## 7. Validation behavior

Validation must distinguish at least:

- Missing frontmatter.
- Malformed YAML.
- Missing required fields.
- Invalid field types or values.
- Unknown top-level fields.
- Invalid tags or `extra` shape.
- Duplicate identifiers.
- Invalid document references or relationships.
- Unsupported schema versions.

Diagnostics should identify the file and provide field/line context where available, plus a useful explanation of the expected value.

The CLI, dashboard, TUI, and agent-facing capabilities must consume the same schema registry and validation behavior.

## 8. Schema evolution

Schema versioning is required as a design concern. The exact representation, whether a version is declared per document or resolved through workspace configuration, and the compatibility/migration policy remain open decisions.

Changes to required fields, field meaning, allowed values, or relationship semantics must be deliberate and documented. Task should not silently reinterpret old documents.

## 9. Illustrative document

The following demonstrates the intended shape only; it is not a finalized task schema:

```markdown
---
id: TASK-0001
name: Define the workspace metadata schema
type: task
tags:
  - architecture
  - metadata
extra:
  source: product-planning
  review:
    required: true
---

# Define the workspace metadata schema

Human-readable description, context, acceptance criteria, and notes belong in the Markdown body.
```

## 10. Open design work

Before implementation, define:

- The complete common schema and optional fields.
- The document type catalogue and each type's schema.
- The schema definition/registry format and ownership.
- The custom field and custom document type extension mechanism.
- Tag normalization and constraints.
- Safe `extra` value constraints and limits.
- Schema version representation and migration policy.
- Relationship syntax and validation.
- Workspace exclusions and generated-file handling.

## Related decisions

- [Decision 0002: Frontmatter applies only inside the configured Task workspace](../../tasks/decisions/0002-markdown-frontmatter-contract.md)
- [Decision 0003: Structured and extensible Markdown frontmatter schema](../../tasks/decisions/0003-structured-frontmatter-schema.md)
