---
id: DOC-GUIDES-INSTALL-ONCE-USE-ANYWHERE
name: Install Once Use Anywhere
type: documentation
tags:
  - engineering
---

# Install Task once and use it in any project

Task is designed to be a **single, machine-wide command-line tool** that can work with many independent project repositories on the same computer.

You install the Task executable once. You do not install a separate copy of Task inside every project. When you run it from a project directory, Task discovers that repository and reads that project's own configuration and managed workspace.

> **Implementation status:** This document records the intended user experience and distribution architecture. The current repository has a minimal CLI shell; installers, release binaries, `task init`, workspace discovery, `task run`, and the dashboard are not implemented yet. Installation commands and package-manager names below are examples of the future experience, not working download instructions.

## 1. The mental model

There are two separate things:

1. **The Task application** — one executable installed on your computer and available on your PATH.
2. **A Task workspace** — project-specific configuration and Markdown records stored inside each repository.

The executable is shared. Project data is not.

For example, one installation can be used across all of these repositories:

```text
Computer
├── Task executable                    # installed once
│
└── Projects/
    ├── defy/
    │   ├── task.yaml                  # Defy-specific Task configuration
    │   └── tasks/                     # Defy work records
    │
    ├── mzizi/
    │   ├── task.yaml                  # Mzizi-specific Task configuration
    │   └── tasks/                     # Mzizi work records
    │
    └── another-project/
        └── tasks/                     # default workspace; config is optional
```

Each repository can be committed, branched, reviewed, cloned, or shared independently. This local workflow does not require a central hosted account or a cloud database. Task also supports an optional hosted account for users who want cross-device access, collaboration, or cloud-native projects.

## 2. Install Task once

The intended release model is to distribute standalone executables for supported operating systems and CPU architectures. A standalone build means users should not need to install Bun, Node.js, or a project-specific runtime just to use Task.

The planned installation options are:

| Platform | Intended distribution |
| --- | --- |
| Linux | Downloadable standalone binary and install script |
| macOS | Standalone binary, with Homebrew as a possible package-manager channel |
| Windows | Standalone executable, with Winget or Scoop as possible package-manager channels |
| Other environments | Direct binary download where a supported build is available |

The final supported platforms, package managers, signing, checksums, update mechanism, and release channels still need to be selected and implemented.

### Example of the intended first-time experience

The following is illustrative only. The domain is a placeholder and must not be used as an actual installation URL:

```sh
# Example only — no public installer URL is available yet.
curl -fsSL https://example.invalid/task/install.sh | sh

# After a real installation:
task --version
task --help

# The short alias invokes the same application:
tk --version
```

The installer should detect the operating system and architecture, obtain the matching published release, and place the executable in a user-accessible location on PATH. It should explain any PATH setup required and verify that the installed command can run.

**Do not run the example installer command:** it uses a reserved placeholder domain. Use an official release channel only once one is published.

## 3. Use the same installation in any repository

After installation, open any project directory in a terminal and invoke `task` or `tk`.

```sh
cd ~/Projects/defy
task --help

cd ~/Projects/mzizi
task --help
```

Task should resolve the current repository from the working directory, load its configuration, and operate on that repository's workspace. Moving to another repository changes the project context; it does not require another installation.

The intended context-resolution behavior is:

1. Find the Git repository containing the current working directory (or otherwise identify the supported project root).
2. Read the repository's root `task.yaml`, if present.
3. Resolve the configured Task workspace directory.
4. If no configuration file or workspace setting exists, use the default `tasks/` directory.
5. Discover and validate the in-scope workspace documents using the shared metadata schemas.
6. Perform the requested command against that repository only.

If Task cannot identify a project context, it should give a clear explanation and guide the user to initialize or enter a project rather than silently creating files in an arbitrary directory. Exact behavior outside a repository remains to be specified.

## 4. Initialize Task in a project

The planned onboarding command is:

```sh
cd ~/Projects/my-project
task init
```

Initialization should be project-local and should not reinstall or copy the Task executable. It should create the repository configuration and the default managed workspace only when appropriate.

The intended default is:

```text
my-project/
├── task.yaml
└── tasks/
    └── README.md
```

The exact configuration key and complete `task.yaml` schema are still being designed. The workspace defaults to `tasks/`; a project may select another directory, for example `.tasks/` or `tasks/docs/`, through its configuration.

Initialization must respect existing files and directories. It should explain conflicts and ask before overwriting user content. It should not add Task frontmatter to unrelated repository Markdown.

### Project-specific configuration

Each repository owns its own `task.yaml`. It describes how Task should interpret that repository; it is not a machine-wide configuration file.

Conceptually:

```yaml
# Illustrative only; the exact key and schema are not finalized.
workspace: tasks
```

A different project could choose a different managed directory:

```yaml
# Illustrative only.
workspace: .tasks
```

The configuration contract must be finalized before these examples become normative.

## 5. Keep project data with the project

Task's intended source of truth is the repository's managed workspace: Markdown documents with structured YAML frontmatter, tracked by Git.

- Task records, decisions, handoffs, research, and project documentation live in the configured workspace.
- The workspace defaults to `tasks/`.
- Only Markdown files inside the configured Task-managed workspace require Task frontmatter.
- Ordinary Markdown elsewhere in the repository — such as the root `README.md`, `AGENTS.md`, or engineering docs outside the managed workspace — remains ordinary Markdown.
- In this repository, engineering documentation in `tasks/docs/` is inside the default managed workspace and follows the frontmatter contract.
- The common frontmatter fields are `id`, `name`, and `type`. Type-specific schemas add their own fields. `tags` is supported as structured categorisation metadata, and `extra` is the explicit place for supplemental metadata. Unknown top-level fields remain subject to schema validation.

This keeps project work portable: cloning the repository brings its Task workspace with it, and committing changes lets the team collaborate through the same Git workflow as the code.

## 6. Run the local dashboard

The intended command for the local web interface is:

```sh
task run
```

A port can be selected when needed:

```sh
task run -p 3004
```

The dashboard is intended to run locally and read the current repository's configured workspace. It should not require a separate cloud account, hosted service, or external database for the core local workflow.

The server should bind to localhost by default. Access from other devices or network interfaces should require an explicit configuration and clear security implications. The dashboard should use the same domain rules and schemas as the CLI rather than implementing a second interpretation of workspace data.

The `task run` command and dashboard are planned, not currently implemented.

## 7. Update the application separately from project data

There are two different lifecycles:

- **Task application update:** updates the one installed executable on the computer.
- **Project workspace/configuration change:** changes files in a particular repository, normally reviewed and version-controlled with that project.

A future command may provide an application update experience such as:

```sh
task update
task update --check
```

These commands are examples of a possible interface, not implemented commands. The final update mechanism must verify release authenticity and integrity, handle permissions and rollback safely, and clearly report the installed and available versions.

An application update must not silently rewrite every repository's configuration or migrate every workspace. Any required workspace/schema migration should be explicit, scoped to the current repository, explain the proposed changes, and preserve user data. The compatibility policy and migration commands remain to be designed.

## 8. What happens when a project is cloned or moved?

Because project records live with the repository:

- **Clone:** clone the repository, install Task on the new computer if it is not already installed, then run Task from the cloned directory.
- **Move:** move the repository as usual; Task should discover its context from the new location rather than depend on a machine-specific absolute path.
- **New project:** use the existing Task installation and initialize the new repository when desired.
- **Multiple projects:** switch directories; Task uses the configuration and workspace of the current repository.
- **No Task configuration:** use the default `tasks/` workspace unless the user initializes or configures another one.

No per-project Task executable, global task database, or hosted account is necessary for the core repository-native workflow. Cloud features are opt-in for local users; cloud-native projects are also supported for people who do not want to manage a Git repository.



## 9. Choose how each workspace is used

Task supports three workspace modes:

| Mode | Where work lives | Account/network |
| --- | --- | --- |
| Local | In the repository's configured workspace and Git history | Not required |
| Connected | In the local repository and a linked Task Cloud workspace | Account and network required for cloud synchronization; local work remains available offline |
| Cloud-native | In Task Cloud, without a required Git repository | Account and network required for hosted operations |

A user can have personal work and participate in multiple organizations from one account. Organization workspaces have their own membership and access rules. The hosted website and mobile app provide access to work the user is authorized to see.

Connecting a repository is an explicit action. Task must not silently upload a repository or make local work dependent on the cloud. The connected-workspace synchronization design must define initial reconciliation, record identity, revisions, conflict handling, deletion behavior, and recovery before implementation.

## 10. One account across web, mobile, and CLI

The intended account experience lets a user:

- Sign in to the hosted website and see personal work and work shared with them by organizations.
- See assigned tasks across all workspaces they are authorized to access.
- Access supported tasks and project information from the mobile app.
- Authenticate the CLI when they choose to use cloud-native or connected workspaces.
- Continue using local-only repositories without signing in.

A profile represents a person; it is not itself a project or organization. A user may belong to several organizations. Workspace membership and permissions determine which shared records appear in cross-project views.

The exact sign-in methods, CLI authentication commands, organization roles, and invitation flows remain to be designed.

## 11. Design and implementation checklist

The user experience is not complete until these pieces exist:

- [ ] Publish standalone binaries for the selected OS/architecture targets.
- [ ] Define release signing, checksums, provenance, and official download locations.
- [ ] Implement and document safe installation and PATH setup.
- [ ] Decide which package-manager channels to support and maintain their manifests/formulae.
- [ ] Implement `task init` with safe handling of existing files.
- [ ] Finalize and validate the root `task.yaml` schema, including the workspace setting.
- [ ] Implement repository discovery and workspace resolution consistently for all commands.
- [ ] Implement the default `tasks/` behavior when configuration is absent.
- [ ] Implement the shared Markdown metadata schema and workspace validation.
- [ ] Implement the local dashboard and `task run -p PORT` behavior.
- [ ] Define application update, version compatibility, and explicit workspace migration behavior.
- [ ] Document uninstall, upgrade, downgrade, and recovery procedures.
- [ ] Verify the complete install → initialize → use in multiple repositories workflow on every supported platform.
- [ ] Implement optional account authentication without making it a prerequisite for local-only use.
- [ ] Implement personal and organization workspace ownership and API authorization.
- [ ] Define and implement connected-workspace synchronization and conflict recovery.
- [ ] Implement cloud-native workspaces and hosted web/mobile clients.

## 12. Current repository status

At the time this guide was written, the repository contains a minimal Bun/TypeScript CLI shell and the accepted direction for a repository-local, Markdown-based workspace. The following are not yet implemented: production CLI packaging, published binaries, installers, package-manager distribution, `task init`, automatic repository/workspace discovery, `task validate`, `task run`, the dashboard, hosted API, cloud persistence, authentication, synchronization, hosted web/mobile clients, and self-update.

Until those features are implemented and official releases are published, this guide describes the agreed product direction and planned user experience — not a currently installable release.
