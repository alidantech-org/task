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

Only create a package or application directory when it contains real code or an intentional package boundary. The local application and shared packages are part of the intended architecture, but are not scaffolded as empty placeholders in this first shell.

## Initial technology decisions

- Bun is the package manager and runtime.
- TypeScript is used for source code.
- The repository is a private Bun workspace, even though the GitHub repository is public.
- The first executable is the CLI app under `source/apps/cli`.
- The CLI package exposes both `task` and `tk` binaries from one entry point.
- Workspace operations and domain behavior will be implemented with clear ownership and extracted into shared packages only when real reuse and stable contracts justify it. The hosted API and synchronization are later phases. The accepted product direction is hybrid: local-first, connected repository, and cloud-native workspaces.
- No generated SDK, database, hosted service, framework, or test runner is introduced at this stage.

## Task-managed Markdown architecture

Task frontmatter applies only within the configured Task-managed workspace, not to every Markdown file in the repository.

- The default workspace directory is `tasks/`.
- A repository may configure a different workspace directory in `task.yaml`, for example `.docs/` or `.tasks/`.
- Every Markdown file inside the selected workspace uses YAML frontmatter as its machine-readable metadata contract. Common required fields are `id`, `name`, and `type`; type-specific schemas define additional fields.
- The frontmatter schema is intended to be strict and extensible: it supports structured `tags`, an explicit `extra` mapping for supplemental data, and type-specific fields. Unknown top-level fields are invalid unless declared by the active schema or a supported workspace extension.
- Repository-level `task.yaml` configures Task and selects the managed workspace; it is not the per-document frontmatter.
- Ordinary repository Markdown outside the selected workspace (such as root `README.md`, `AGENTS.md`, and unconfigured `.docs/`) remains ordinary Markdown and does not require Task frontmatter.
- The Markdown body holds human-readable content. The same schema definitions drive CLI validation and document discovery/presentation in the local web UI.
- Missing or malformed frontmatter inside the managed workspace is a validation error.

See [Markdown metadata and schema architecture](markdown-metadata-schema.md) and the accepted decisions in `tasks/decisions/`.

The local application is intended to run through `task run`. The CLI starts or manages the local runtime, which serves the local dashboard and exposes restricted HTTP and WebSocket interfaces. CLI commands use workspace operations directly; dashboard actions use the same operations through the local HTTP API. The local application is independent of the hosted API and remains useful without an account or network. The hosted website is a separate application deployed at `task.alidantech.org` and connects directly to `task-api.alidantech.org`. The planned Flutter mobile app also connects directly to the hosted API. Git is optional for local workspaces. Future two-way sync must support multiple local device replicas. See [platform architecture](platform-architecture.md) and Decisions [0004](../../tasks/decisions/0004-hybrid-cloud-platform.md), [0006](../../tasks/decisions/0006-local-and-hosted-application-boundaries.md), [0007](../../tasks/decisions/0007-file-based-local-workspaces.md), and [0008](../../tasks/decisions/0008-multi-device-two-way-sync.md).

## Deliberately deferred

- Exact `task.yaml` configuration schema and workspace-setting key.
- Complete common and type-specific document schemas, field types, and allowed values.
- Schema registry format, custom fields/types, and schema versioning/migration policy.
- Workspace initialization and discovery behavior.
- Task lifecycle, statuses, dependencies, and semantic validation rules.
- CLI command framework and command registration design.
- Shared core/workspace package APIs.
- Local and hosted application frameworks and any justified component/design-system sharing.
- Local runtime HTTP/WebSocket API, process lifecycle, origin protection, and reconnect/snapshot design.
- TUI framework, interaction model, and keybindings.
- Hosted API module contracts, identity/organization ownership model, and cloud persistence.
- Connected-workspace sync protocol, authority rules, and conflict resolution.
- Automated test framework and CI workflows.

The workspace boundary and the direction for a strict, extensible frontmatter schema are accepted; detailed schemas and configuration contracts remain to be designed.

## Development workflow

- Work on `develop`.
- Keep `main` stable.
- Use `.docs/` for engineering documentation and the configured workspace for Task-managed work and project context.
- Prefer small, reviewable commits. Do not add generated output or dependency directories to Git.

## Source implementation status

Only `source/apps/cli` is scaffolded. The intended source layout is a standalone NestJS project at `source/api/` plus `source/apps/local/`, `source/apps/site/`, `source/apps/mobile/`, and `source/apps/tui/`. The local application owns the local dashboard and runtime; the hosted website is a separate cloud client. The CLI starts/manages the local application while ordinary CLI commands remain usable without it. The hosted website and Flutter mobile client connect directly to the hosted API. Local workspaces are file-based and Git-optional; future two-way sync supports multiple local replicas. These applications will be added when their contracts and implementation are ready. Shared packages and API module directories are not pre-created; see [source layout](source-layout.md) and Decisions [0006](../../tasks/decisions/0006-local-and-hosted-application-boundaries.md), [0007](../../tasks/decisions/0007-file-based-local-workspaces.md), and [0008](../../tasks/decisions/0008-multi-device-two-way-sync.md).
