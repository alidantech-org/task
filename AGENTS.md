---
id: TASK-AGENTS
name: Repository and agent guidance
type: agent-guidance
---

# Repository guidance

## Source of truth and layout

- Work on the `develop` branch; keep `main` stable.
- Put application and package source under `source/`.
- Use `.docs/` for engineering documentation about this software project.
- Use `tasks/` for Task-managed work records and evolving project context.
- Do not create a second task database or duplicate authoritative records in root `TODO.md`.
- Do not add a generated `sdk/` directory.

## Working agreements

- Plan before making broad or structural changes. Keep work focused and report what changed.
- Do not invent product behavior, compatibility requirements, schemas, or lifecycle rules. Record unresolved decisions rather than silently choosing.
- Avoid speculative packages, empty placeholder directories, and unnecessary abstractions.
- Keep domain rules shared; do not duplicate business logic across the CLI, dashboard, and terminal interfaces.
- Prefer explicit types. Avoid `any` and `unknown` unless there is a documented boundary that requires them.
- Do not run builds or tests unless requested. A focused typecheck may be used when necessary and should be reported.
- Do not modify `.github/**` or GitHub automation unless explicitly approved with the phrase `APPROVED: MODIFY GITHUB AUTOMATION`.

## Documentation and Markdown contract

- Every Markdown file managed by Task, including documentation in `.docs/` and `tasks/`, must begin with YAML frontmatter delimited by `---`.
- Frontmatter must include the common required fields `id`, `name`, and `type`; apply the appropriate type-specific schema when one has been defined.
- The YAML frontmatter is machine-readable metadata; the Markdown body is human-readable content.
- Create new Markdown files with frontmatter from the outset. Do not introduce frontmatter-free Markdown.
- `task validate` / `tk validate` must validate all in-scope Markdown, including documentation. Missing or malformed frontmatter is an error.
- The local application started by `task run` must discover and present documents using their metadata, not a separate manually maintained registry.
- The validator and UI must share the same schema definitions and document interpretation.
- Update `.docs/` when engineering setup, architecture, or implementation behavior changes.
- Use `tasks/decisions/` for meaningful product and project decisions, and `tasks/handoffs/` for agent handoffs.
- Keep root `README.md` concise and aligned with the actual repository state.
