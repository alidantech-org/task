---
id: DEC-0007
name: File-based local workspace storage and optional Git
type: decision
status: accepted
created_at: 2026-10-31
---

# Decision 0007: File-based local workspace storage and optional Git

- **Status:** Accepted
- **Date:** 2026-10-31
- **Scope:** Local workspace persistence, configuration, managed files, Git integration, and future cloud compatibility

## Context

Task must provide a useful local-first workflow without requiring an account, network connection, hosted service, or database server. Users need to inspect and edit their work with ordinary tools, preserve it in version control when they choose, and later connect the workspace to Task Cloud.

## Decisions

1. **Use files as the authoritative local workspace storage.** Task-managed tasks, documents, decisions, and other supported records are stored as files using the agreed Markdown/YAML metadata contract and ordinary file content.
2. **Do not require SQLite or another database for authoritative local records.** Local indexes, caches, search indexes, locks, or operational metadata may use derived local storage when justified, but they must be rebuildable or recoverable from authoritative workspace files and must not become a competing source of truth.
3. **Make Git optional.** A workspace is a directory with Task configuration and managed content; it does not have to be a Git repository. When Git is present, Task should work naturally with it and avoid interfering with user-managed Git history or operations.
4. **Keep Git separate from Task Cloud sync.** Git history/branch operations and Task's future workspace synchronisation solve different problems. Neither should be a prerequisite for the other.
5. **Use workspace configuration to define the managed boundary.** The root `task.yaml` identifies the Task-managed workspace location and applicable configuration. The default managed directory remains `tasks/`; a workspace may configure another location, such as `.tasks/` or `tasks/docs/`.
6. **Apply Task document metadata rules only inside the configured managed boundary.** Ordinary Markdown elsewhere in the project remains ordinary Markdown. Task must not rewrite unrelated project files.
7. **Preserve human-readable and portable content.** Prefer stable, documented file formats and relative references where appropriate. Users must be able to inspect and edit supported workspace content without requiring the Task application.
8. **Keep local commands offline-capable.** Initialisation, discovery, reading, writing, listing, and validation of local workspace files must not require cloud identity or connectivity.
9. **Prepare for cloud identity without making local files cloud-dependent.** Workspace and record identifiers must be stable and stored in a documented, portable manner where required by the sync design. Cloud credentials and private tokens must not be written into ordinary workspace files or committed configuration.
10. **Protect file integrity.** File writes should be validated and performed safely, with clear handling for interrupted writes, malformed metadata, external edits, renames, and deletion. Destructive or broad operations must be explicit.

## Workspace shape

The exact document schemas and configuration schema remain separate design work. The conceptual layout is:

```text
workspace/
├── task.yaml
├── tasks/                 # Default Task-managed content
│   ├── ...
│   └── decisions/
├── documents/             # Optional configured or ordinary content
└── ...                    # Unmanaged project files remain untouched
```

A workspace may itself be a Git repository, but this is not required. The Task-managed directory may be configured. Do not assume every Markdown file below the project root is Task-managed.

## Consequences

- Local use has no mandatory database installation or cloud dependency.
- Users retain direct access to their data and can use Git if it fits their workflow.
- Task needs clear workspace discovery, configuration, schema validation, and safe file-operation contracts.
- Future cloud storage must map to stable local file identities and preserve exportability.
- Search/indexing performance can be improved with derived local indexes without changing file authority.

## Deferred decisions

- Exact `task.yaml` schema and workspace discovery precedence.
- Full frontmatter schemas, document types, custom fields, and schema evolution.
- Exact stable ID format and clone/fork identity semantics.
- File naming, renames/moves, attachment representation, and cross-file references.
- Derived index/cache implementation and invalidation strategy.
- Atomic write strategy and recovery details.
- Cloud representation and Markdown/file-to-record mapping.
- Git integration scope beyond working safely inside an existing repository.

These details must be resolved before implementation depends on them.
