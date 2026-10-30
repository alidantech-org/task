# Repository guidance

## Source of truth and layout

- Work on the `develop` branch; keep `main` stable.
- Put application and package source under `source/`.
- Use `.docs/` for engineering documentation about this software project by convention.
- Use the configured Task-managed workspace for work records and evolving project context; it defaults to `tasks/`.
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

## Task workspace and Markdown contract

- The Task-managed workspace is selected by repository configuration in `task.yaml`; when no configuration file or workspace setting exists, the default workspace directory is `tasks/`.
- The workspace may be configured to another directory, for example `.docs/` or `.tasks/`. The configured directory is the boundary for Task-managed content.
- Every Markdown file inside the configured Task-managed workspace must begin with YAML frontmatter delimited by `---`.
- Frontmatter must include the common required fields `id`, `name`, and `type`; apply the appropriate type-specific schema.
- Frontmatter is a strict, extensible metadata contract: use structured `tags` for categorisation and an explicit `extra` mapping for supplemental data. Unknown top-level fields are invalid unless the applicable schema or supported workspace extension declares them. Do not treat `extra` as a way to bypass validation.
- Repository-level `task.yaml` configures Task and the workspace; it is not the YAML frontmatter placed in individual Markdown files.
- Markdown files outside the configured workspace, including ordinary root `README.md`, `AGENTS.md`, and engineering documentation under `.docs/` when it is not the configured workspace, do not need Task frontmatter.
- The YAML frontmatter is machine-readable metadata; the Markdown body is human-readable content.
- Create new Markdown files inside the managed workspace with frontmatter from the outset.
- `task validate` / `tk validate` must validate all in-scope Markdown inside the configured workspace. Missing or malformed frontmatter is an error. It must not impose this rule on unrelated repository Markdown outside the workspace.
- The local application started by `task run` must discover and present documents from the configured workspace using their metadata.
- The validator and UI must share the same schema definitions and document interpretation.
- Update `.docs/` when engineering setup, architecture, or implementation behavior changes.
- Use the managed workspace's `decisions/` and `handoffs/` areas for meaningful decisions and agent handoffs.
- Keep root `README.md` concise and aligned with the actual repository state.
