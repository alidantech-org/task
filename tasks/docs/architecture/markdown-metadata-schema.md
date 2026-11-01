---
id: DOC-ARCHITECTURE-MARKDOWN-METADATA-SCHEMA
name: Markdown Metadata Schema
type: documentation
tags:
  - engineering
---

# Markdown metadata and schema architecture

This document describes the metadata contract used by the shared `@task/workspace` parser and validator. Schema evolution, versioning, and extensible type registration remain future design work.

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

See [Decision 0002](../../decisions/0002-markdown-frontmatter-contract.md).

## 3. Metadata contract

The schema system has four layers:

1. **Common identity fields:** required fields shared by every managed document: `id`, `name`, and `type`.
2. **Common optional metadata:** `tags` is an optional sequence of unique, non-empty strings; `extra` is an optional mapping for supplemental data.
3. **Type-specific metadata:** the parser supports task records, decisions, general documentation, rules, and agent profiles. `documentation`, `rule`, and `agent-profile` documents currently use the common fields plus optional `tags` and `extra`. Task status is `planned`, `in-progress`, `blocked`, `completed`, or `archived`; priority is `low`, `medium`, or `high`. New tasks default to `planned` and `medium`.
4. **Explicit extension metadata:** the `extra` mapping for supplemental information that is not part of the common or type-specific contract.

Task operations use `extra.status_history` for validated status transitions and `extra.hidden_from_recent` to keep a completed task out of the recent-completion panel without changing its status. The `archived` status keeps task files in their groups; legacy individual archive paths remain readable for compatibility.

The contract is strict at the top level: an unknown field is an error unless the active schema or a supported workspace extension explicitly declares it. The `extra` mapping is the intentional extension point; it is not permission to add arbitrary top-level keys or bypass validation.

## 4. Tags

`tags` is a first-class optional metadata field represented as a YAML sequence of strings:

```yaml
tags:
  - architecture
  - metadata
  - developer-experience
```

The parser validates that tags are a sequence of unique, non-empty strings. Search and filter comparisons are case-insensitive; tags retain their authored casing.

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
- Explicit limits for document size and YAML nesting remain future hardening work.

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

The `documentation`, `rule`, and `agent-profile` types currently use the common document fields plus `tags` and `extra`; their body carries human-readable guidance. Project setup stores generated adapter targets and evidence paths in `extra`. Other types such as projects, handoffs, research, specifications, meeting notes, and milestones currently use the general document fields. Dedicated schemas for them remain future work.

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

## 9. Task document

New task records created by the shared workspace engine use this shape (optional fields omitted):

```markdown
---
id: TSK-012345ABCDEF
name: Define the workspace metadata schema
type: task
status: planned
priority: medium
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

## 10. Remaining schema design work

Future work may define:

- Additional common metadata and dedicated schemas for other document types.
- The schema definition/registry format and ownership.
- The custom field and custom document type extension mechanism.
- Further tag normalization and constraints.
- Safe `extra` value constraints and limits.
- Schema version representation and migration policy.
- Relationship syntax and validation.
- Workspace exclusions and generated-file handling.

## Related decisions

- [Decision 0002: Frontmatter applies only inside the configured Task workspace](../../decisions/0002-markdown-frontmatter-contract.md)
- [Decision 0003: Structured and extensible Markdown frontmatter schema](../../decisions/0003-structured-frontmatter-schema.md)
