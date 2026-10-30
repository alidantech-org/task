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

### Documentation and Task workspace

We use two distinct locations with different responsibilities:

- **`.docs/`** contains documentation about the Task software project: architecture, development setup, contributor guidance, implementation guides, and operational/reference material.
- **`tasks/`** is the Task-managed workspace. It holds the repository's own task records and evolving project context, including product requirements, research, decisions, handoffs, and workspace state. This is also the visible workspace convention that `task init` should create in other projects.

Do not duplicate the same document in both locations. Use `.docs/` to explain how the software is built and maintained; use `tasks/` for the work and project knowledge managed through Task.

The intended starting shapes are:

```text
.docs/
├── README.md
├── architecture/
├── development/
├── guides/
└── reference/

tasks/
├── README.md
├── config.yaml
├── TASK-0001.md
├── docs/
│   ├── product/
│   ├── research/
│   └── benchmarks/
├── decisions/
├── handoffs/
├── state/
└── archive/
```

These are conventions, not a requirement to create empty directories. Add subdirectories and workspace records as real needs emerge.

- Individual task and knowledge records in `tasks/` are authoritative.
- Root-level `TODO.md` is a convenient overview/index, not a second source of truth.
- Prefer stable task identifiers so records can link to one another.

### CLI names

The product is named **Task**. The CLI should be available through both `task` and `tk`; both names invoke the same implementation and support the same commands.

## Development workflow

- `main` is the stable branch.
- `develop` is the active integration branch.
- Day-to-day implementation and feature work should happen on `develop`.
- Promote reviewed, working changes from `develop` to `main` when ready for a stable milestone.

Keep changes focused. Record meaningful product/work decisions in `tasks/decisions/` and keep repository engineering documentation in `.docs/`.

## Current status

This README records the initial project direction and repository conventions. The directory trees above are proposed structures; they do not imply that the applications, packages, or workspace tooling have been implemented yet.
