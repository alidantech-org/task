# Repository shell plan

This note records the initial implementation shell. It deliberately establishes the repository's tooling and boundaries without pretending that the task model, persistence format, or application features have already been designed.

## Initial layout

```text
task/
├── .docs/                  # Engineering and software documentation
├── tasks/                  # Task-managed project workspace and records
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

## Deliberately deferred

- Task schema and Markdown/frontmatter contract.
- Workspace configuration schema and initialization behavior.
- Task lifecycle, statuses, dependencies, and validation rules.
- CLI command framework and command registration design.
- Shared core/workspace package APIs.
- Dashboard framework and local server/API design.
- Automated test framework and CI workflows.

These need focused design decisions before implementation. The shell should not lock them in accidentally.

## Development workflow

- Work on `develop`.
- Keep `main` stable.
- Use `.docs/` for engineering documentation and `tasks/` for Task-managed work and project context.
- Prefer small, reviewable commits. Do not add generated output or dependency directories to Git.
