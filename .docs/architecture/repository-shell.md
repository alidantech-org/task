# Repository shell plan

This note records the initial implementation shell. It deliberately establishes the repository's tooling and boundaries without pretending that the complete task model, persistence format, or application features have already been designed.

## Initial layout

```text
task/
├── .docs/                  # Engineering and software documentation
├── tasks/                  # Default Task-managed project workspace and records
├── source/
│   └── apps/
│       └── cli/             # Initial executable entry point
├── AGENTS.md                # Repository-wide agent/developer instructions
├── README.md
├── package.json             # Bun workspace root and shared scripts
├── tsconfig.json
└── .gitignore
```

Only create a package or application directory when it contains real code or an intentional package boundary. The dashboard and shared packages are part of the intended architecture, but are not scaffolded as empty placeholders in this first shell.

## Initial technology decisions

- Bun is the package manager and runtime.
- TypeScript is used for source code.
- The repository is a private Bun workspace, even though the GitHub repository is public.
- The first executable is the CLI app under `source/apps/cli`.
- The CLI package exposes both `task` and `tk` binaries from one entry point.
- Core domain behavior, workspace/file persistence, and dashboard integration will be introduced as explicit packages when their contracts are designed.
- No generated SDK, database, hosted service, framework, or test runner is introduced at this stage.

## Task-managed Markdown architecture

Task frontmatter applies only within the configured Task-managed workspace, not to every Markdown file in the repository.

- The default workspace directory is `tasks/`.
- A repository may configure a different workspace directory in `task.yaml`, for example `.docs/` or `.tasks/`.
- Every Markdown file inside the selected workspace uses YAML frontmatter as its machine-readable metadata contract. Common required fields begin with `id`, `name`, and `type`; type-specific schemas define additional fields.
- Ordinary repository Markdown outside the selected workspace (such as root `README.md`, `AGENTS.md`, and unconfigured `.docs/`) remains ordinary Markdown and does not require Task frontmatter.
- The Markdown body holds human-readable content. The same schema definitions drive CLI validation and document discovery/presentation in the local web UI.
- Missing or malformed frontmatter inside the managed workspace is a validation error.

The local UI is intended to run through `task run`, with a configurable port such as `task run -p 3004`. It should discover documents from the configured workspace and use their metadata to organize navigation, listings, filters, and document pages.

## Deliberately deferred

- Exact `task.yaml` configuration schema and workspace-setting key.
- Complete type-specific document schemas, field types, and allowed values.
- Workspace initialization and discovery behavior.
- Task lifecycle, statuses, dependencies, and semantic validation rules.
- CLI command framework and command registration design.
- Shared core/workspace package APIs.
- Dashboard framework and local server/API design.
- Automated test framework and CI workflows.

The workspace boundary and frontmatter requirement are accepted; the precise configuration key and complete type-specific schemas remain to be designed.

## Development workflow

- Work on `develop`.
- Keep `main` stable.
- Use `.docs/` for engineering documentation and the configured workspace for Task-managed work and project context.
- Prefer small, reviewable commits. Do not add generated output or dependency directories to Git.
