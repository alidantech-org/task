# Task

Task is a repository-native task and project management system built with Bun and TypeScript.

The project is intended to provide three complementary interfaces over one shared task-management core:

- **CLI** for developers and AI agents.
- **Local dashboard** for visual project and Kanban management.
- **Terminal interface** for interactive terminal workflows.

The repository and each initialized project should keep task records and project knowledge versioned alongside the code. Markdown files and Git are the foundation; a hosted service or external database should not be required.

## Repository conventions

### Source code

Application and package source code lives under `source/`:

```text
source/
├── apps/
│   ├── cli/
│   └── dashboard/
└── packages/
    ├── core/
    └── workspace/
```

This is the intended starting organization, not a claim that all directories already exist. Add packages when there is a concrete need; avoid empty or speculative packages. The core owns domain rules and task lifecycle behavior. Workspace concerns include reading and writing project files, Markdown/frontmatter, configuration, indexing, and Git integration. The CLI, dashboard, and terminal interface should use the same core rather than implementing separate business logic.

There is no generated SDK directory in this repository. Internal schemas and contracts may live with the code that owns them.

### Project records and documentation

Use **`tasks/`** as the visible, repository-level workspace directory. Do not use `.tasks/` or `.task/` for this purpose.

```text
tasks/
├── config.yaml
├── TASK-0001.md
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── research/
│   └── benchmarks/
├── decisions/
├── handoffs/
├── state/
└── archive/
```

This is the intended convention for this repository and for projects initialized by `task init`. The exact subdirectories can grow as real needs emerge.

- Individual task and knowledge records are the source of truth.
- Root-level `TODO.md` is a convenient overview/index, not a second source of truth.
- Keep task records, project documentation, decisions, handoffs, and related records together under `tasks/`.
- Prefer stable task identifiers so records can link to one another.

### CLI names

The product is named **Task**. The CLI should be available through both `task` and `tk`; both names invoke the same implementation and support the same commands.

## Development workflow

- `main` is the stable branch.
- `develop` is the active integration branch.
- Day-to-day implementation and feature work should happen on `develop`.
- Promote reviewed, working changes from `develop` to `main` when ready for a stable milestone.

Keep changes focused and document meaningful architectural decisions in `tasks/decisions/`.

## Current status

This README records the initial project direction and repository conventions. The directory tree above is a proposed structure; it does not imply that the applications, packages, or workspace tooling have been implemented yet.
