# Repository guidance

## Source of truth and layout

- Work on the develop branch; keep main stable.
- Put application and package source under source/.
- Use tasks/docs/ for engineering documentation about this software project; it is part of the Task-managed workspace so the UI can discover it.
- Use the configured Task-managed workspace for work records and evolving project context; it defaults to tasks/.
- Do not create a second task database or duplicate authoritative records in root TODO.md.
- Do not add a generated sdk/ directory.

## Working agreements

- Plan before making broad or structural changes. Keep work focused and report what changed.
- Do not invent product behavior, compatibility requirements, schemas, or lifecycle rules. Record unresolved decisions rather than silently choosing.
- Avoid speculative packages, empty placeholder directories, and unnecessary abstractions.
- Keep domain rules shared; do not duplicate business logic across the CLI, dashboard, and terminal interfaces.
- Prefer explicit types. Avoid any and unknown unless there is a documented boundary that requires them.
- Do not run builds or tests unless requested. A focused typecheck may be used when necessary and should be reported.
- Do not modify .github/** or GitHub automation unless explicitly approved with the phrase APPROVED: MODIFY GITHUB AUTOMATION.

## Application tooling standards

- Every website and browser application uses Next.js App Router. Do not introduce Vite for web application projects.
- The local dashboard and hosted website remain separate Next.js applications.
- The local Bun runtime remains separate from the Next.js dashboard and owns local filesystem access, workspace-scoped operations, transport, reconciliation, and security.
- The TUI uses OpenTUI with React bindings for a native, keyboard-driven terminal application. It reuses shared workspace operations and must not create a separate task model.
- The CLI uses terminal-aware colour and polished output, with picocolors and @clack/prompts as the accepted presentation foundation.
- Preserve task and tk aliases, machine-readable JSON output, stable exit codes, and non-interactive use for agents and scripts.
- The root Bun workspace manages TypeScript applications and packages. OpenTUI requires Bun 1.3.14 or later.
- Flutter/Dart remains outside the Bun workspace and uses Flutter tooling. Root scripts may delegate Flutter commands but must not make Dart packages Bun workspaces.

## Quality and safety gates

- Biome is the repository formatter, linter, and import organizer. Keep its single root configuration in biome.json.
- Run bun run format to apply formatting and bun run format:check to verify it.
- bun run validate is the single root validation gate: formatting, dependency audit, lint/security rules, all Bun workspace typechecks and tests, API/Next.js builds, and Flutter analyze/tests.
- Keep each Bun workspace's typecheck and test scripts working independently; add tests with new behavior, especially for path boundaries, filesystem operations, authorization and transport.
- Use bun audit to identify known dependency advisories. Do not suppress advisories without a recorded, reviewed reason.
- Local filesystem operations must enforce managed-workspace containment and symlink-aware checks. Lexical path checks alone are not sufficient; account for symlink races when implementing actual writes.
- Local runtime binds to loopback by default. Do not add arbitrary file, shell, or credential endpoints. Add origin/capability protection before exposing workspace data or mutations.

Internal TypeScript imports must use `#/…` in Bun projects and `@/…` in Next.js apps; import across project boundaries by package name. Relative TypeScript imports are prohibited.

See Decision 0011 and tasks/docs/architecture/source-layout.md for the accepted application boundaries.

## Task workspace and Markdown contract

- The Task-managed workspace is selected by repository configuration in task.yaml; when no configuration file or workspace setting exists, the default workspace directory is tasks/.
- The workspace may be configured to another directory, for example tasks/docs/ or .tasks/. The configured directory is the boundary for Task-managed content.
- Every Markdown file inside the configured Task-managed workspace must begin with YAML frontmatter delimited by ---.
- Frontmatter must include the common required fields id, name, and type; apply the appropriate type-specific schema.
- Frontmatter is a strict, extensible metadata contract: use structured tags for categorisation and an explicit extra mapping for supplemental data. Unknown top-level fields are invalid unless the applicable schema or supported workspace extension declares them. Do not treat extra as a way to bypass validation.
- Repository-level task.yaml configures Task and the workspace; it is not the YAML frontmatter placed in individual Markdown files.
- Markdown files outside the configured workspace, including ordinary root README.md and AGENTS.md, do not need Task frontmatter. Engineering documentation under tasks/docs/ is inside the default managed workspace and must have valid metadata.
- The YAML frontmatter is machine-readable metadata; the Markdown body is human-readable content.
- Create new Markdown files inside the managed workspace with frontmatter from the outset.
- task validate / tk validate must validate all in-scope Markdown inside the configured workspace. Missing or malformed frontmatter is an error. It must not impose this rule on unrelated repository Markdown outside the workspace.
- The local application started by task run must discover and present documents from the configured workspace using their metadata.
- The validator and UI must share the same schema definitions and document interpretation.
- Update tasks/docs/ when engineering setup, architecture, or implementation behavior changes.
- Use the managed workspace's decisions/ and handoffs/ areas for meaningful decisions and agent handoffs.
- Project guidance setup is static and review-driven: do not execute scanned project code, silently select policy, modify Git configuration, or launch agents.
- The current workspace archive layout is todo/_archive/YYYY/MM/YYYY-MM-DD-<slug>/; it is intentionally new-only and has no workspace-root archive compatibility or migration path.
- Keep root README.md concise and aligned with the actual repository state.
