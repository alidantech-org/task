---
id: DOC-ARCHITECTURE-WORKSPACE-DISCOVERY
name: Workspace discovery and selection
type: documentation
tags:
  - engineering
  - workspace
---

# Workspace discovery and selection

`@task/workspace` owns local workspace selection for the CLI. The CLI passes the selected root back as an explicit `WorkspaceContext` to shared operations; consumers do not independently parse configuration or interpret workspace files.

## Selection precedence

1. `--workspace <path>` selects a workspace directory. Relative paths resolve from the current working directory.
2. `TASK_WORKSPACE_ROOT` selects a workspace directory when the option is absent.
3. Otherwise, Task walks upward from the current directory and uses the nearest `task.yaml`. Its `workspace` value is a relative path inside that project root; when omitted, it defaults to `tasks/`.
4. If no configuration file is found, the nearest ancestor containing a `tasks/` directory is selected.
5. If nothing matches, the CLI reports that the user should run inside a configured project or pass `--workspace`.

The explicit option wins over the environment variable. Configuration paths must remain within their project root, resolve to a real directory, and may not use absolute paths. A selected explicit or environment directory may be anywhere the caller can access; it is not constrained to the current repository.

## Managed Markdown boundary

The selected directory is the managed workspace boundary. The scanner discovers Markdown recursively, ignores known generated/dependency directories, and does not follow symlinks. Every discovered Markdown document is parsed with the shared metadata reader; malformed frontmatter remains visible as a validation diagnostic while other documents remain queryable.

The frontmatter `type` determines whether a record is a task or a document. Engineering documentation under `tasks/docs/` is indexed as ordinary `documentation`; path alone does not assign document type. Full bodies are read through an explicit shared operation. Workspace files remain authoritative and no database or persistent index cache is used.

## Current limits

This resolver currently reads only the `workspace` key from `task.yaml`; wider application configuration and upward repository discovery are not implemented. Explicit paths and symlink-aware checks reduce common mistakes but do not claim race-safe filesystem operations. Browser-facing workspace routes remain disabled until local origin/capability authorization and safe operation-boundary protections are in place.

`task init [--workspace <relative-path>]` bootstraps a project by creating its workspace directory and `task.yaml`. It refuses to overwrite an existing `task.yaml`, and the workspace path must resolve inside the project. It does not rewrite or initialize unrelated project files.
