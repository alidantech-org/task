---
{id: DOC-GUIDES-INSTALL-ONCE-USE-ANYWHERE,name: Install Once Use Anywhere,type: documentation,tags: [engineering,release]}
---

# Install Task once and use it in any project

Task is a local-first task and project management CLI that operates on the configured workspace in the current project. The npm package is prepared as `taskcode` and exposes `taskcode`, `task`, and `tc` commands from the same CLI.

## Install

The initial npm release requires Bun 1.3.14 or later. npm, pnpm, and Bun can install the package globally; Bun is still the runtime used to execute it.

```sh
npm install --global taskcode
# or: pnpm add --global taskcode
# or: bun add --global taskcode
```

Check the install and initialize a repository:

```sh
taskcode --version
task --version
tc --version
cd ~/Projects/my-project
task init
task run
```

`taskcode`, `task`, and `tc` are aliases for one application. `task` and `tc` remain available for existing scripts and user habits. Ensure the package manager's global binary directory is on `PATH`.

## Runtime and feature requirements

- Bun 1.3.14 or later is required to execute the CLI, shared workspace engine, packaged local runtime, and TUI.
- The local dashboard uses Next.js 16 and requires Node.js 20.9 or later. The npm package installs Next.js as a dependency; `task run` starts its server with Node.js and the packaged workspace runtime with Bun.
- The OpenTUI interface runs with Bun 1.3.14 or later. Node.js TUI execution is not part of the initial support contract.
- npm, pnpm, and Bun are supported as installers; this does not make the CLI runtime independent of Bun.

The first published support matrix must state the operating systems and CPU architectures actually covered by package smoke checks. Do not infer release support for a platform solely because Bun or Node.js runs there.

## Use in projects

Install once, then use the command from any project directory. Task resolves a repository-local `task.yaml` or `tasks/` workspace, or accepts an explicit `--workspace` path or `TASK_WORKSPACE_ROOT` environment variable.

```sh
cd ~/Projects/my-project
task init
task list
task tui
task run --no-open
```

The TUI is a read-only browser; use CLI commands to change tasks. `task run` starts the dashboard and a loopback-only local runtime in the foreground. Press Ctrl+C to stop both processes. The dashboard serves only the selected project's workspace.

## Release preparation status

The package staging script places the dashboard and runtime under `dist/assets`; it must not place a package manifest inside `dist`. The installed CLI locates its root package manifest above the `dist/` entrypoint, then resolves those bundled assets from that root. The regression test covers an older package layout that contains a duplicate `dist/package.json`.

Version `0.1.0` was published with the duplicate-manifest issue, which prevents `task run` from locating the bundled dashboard. Version `0.1.1` fixes dashboard asset lookup. Version `0.1.2` is reserved for the TUI React runtime fix: the bundled TUI must externalize React so it shares the instance used by OpenTUI's React renderer. Before publishing, rebuild and inspect the package with its lifecycle scripts enabled, install it into a clean consumer project, verify all three executable aliases and the CLI/TUI/dashboard workflows, and confirm npm accepts the package version. Publication and registry credentials remain an explicit release action.
