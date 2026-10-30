---
id: DEC-0003
name: Structured and extensible Markdown frontmatter schema
type: decision
status: accepted
created_at: 2026-10-31
---

# Decision 0003: Structured and extensible Markdown frontmatter schema

- **Status:** Accepted
- **Date:** 2026-10-31
- **Scope:** Task-managed Markdown metadata, schemas, validation, and document interfaces

## Context

Task uses Markdown files as repository-native records. Their YAML frontmatter is the machine-readable metadata contract, while the Markdown body remains human-readable content.

The contract must be strong enough for reliable CLI validation, document discovery, filtering, relationships, and consistent web/TUI presentation. It must also be extensible: repositories need tags and room for additional information without turning every document into an unvalidated collection of arbitrary keys.

The repository-level `task.yaml` configuration file and Markdown YAML frontmatter serve different purposes. `task.yaml` configures Task and selects the managed workspace; it is not the frontmatter format and is not placed at the top of each Markdown document.

## Decisions

1. **Scope remains workspace-only.** The frontmatter contract applies only to Markdown files inside the configured Task-managed workspace. Ordinary Markdown outside that boundary is unaffected.
2. **Use YAML frontmatter.** Each in-scope Markdown file starts with a YAML block delimited by `---`. The Markdown body contains the human-readable document.
3. **Require a common identity contract.** Every managed document requires `id`, `name`, and `type`. These fields identify the record and select its document schema.
4. **Use type-specific schemas.** Each supported document type defines its own required fields, optional fields, value types, allowed values, and applicable constraints. A task, project, decision, handoff, and research document must not be forced into one flat schema.
5. **Support tags as structured metadata.** A document may declare `tags` as a YAML sequence of strings. The schema will validate tag values and reject malformed tag collections; tag filtering and discovery use this field consistently.
6. **Provide an explicit extension area.** An `extra` mapping provides a place for supplemental metadata that does not belong to the common or type-specific contract. Its values must remain safe, data-only YAML values. It must not bypass validation of the known fields.
7. **Keep the top-level contract strict.** Unknown top-level fields are validation errors unless they are explicitly declared by the applicable document schema or a supported workspace extension. Arbitrary top-level keys must not silently become accepted metadata.
8. **Keep schema interpretation shared.** The CLI validator, web dashboard, TUI, and agent-facing interfaces use the same schema definitions and parsing rules. They must not maintain separate field definitions.
9. **Make schema evolution explicit.** Schema versioning and migration/compatibility behavior must be designed as part of the schema system rather than inferred from individual documents.
10. **Report actionable validation errors.** Errors identify the file and, where possible, the frontmatter field and line, explain the expected shape, and distinguish missing required fields, invalid values, unknown fields, and invalid references.

## Illustrative frontmatter

This is an illustration of the intended shape, not the final complete task schema:

```yaml
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
    audience:
      - maintainers
---
```

The applicable `task` schema will define task-specific fields such as lifecycle, priority, ownership, scheduling, and relationships. Those fields are not implicitly standardized by this example; their exact names, types, and allowed values must be designed deliberately.

## Consequences

- The metadata contract is richer than the initial `id`, `name`, and `type` minimum.
- Tags are a first-class field rather than an informal convention buried in document text.
- Additional information has an explicit extension location without weakening validation of core metadata.
- Schema definitions become a foundational shared capability and should be designed before implementing document editing, validation, or metadata-driven UI behavior.
- Documentation and examples must distinguish repository `task.yaml` configuration from per-document YAML frontmatter.

## Still to design

- The complete common optional-field set.
- The exact schema format and registry location.
- The complete type catalogue and each type's required/optional fields.
- Tag normalization, case sensitivity, and naming constraints.
- Whether and how workspace owners can declare custom fields or custom document types.
- The allowed YAML value depth/size and parser safety limits for `extra`.
- The schema-version field/representation and upgrade policy.
- Relationship syntax, reference validation, and exclusion rules.
