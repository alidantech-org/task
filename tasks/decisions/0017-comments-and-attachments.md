---
id: DEC-0017
name: Comments, mentions, watchers and attachments
type: decision
status: accepted
created_at: 2026-11-01
---

# Decision 0017: Comments, mentions, watchers and attachments

- **Status:** Accepted
- **Date:** 2026-11-01
- **Scope:** Where comments and attachments live and how authors are identified

## Context

Comments were planned as timestamped entries in the task Markdown but never built, and entries had no author. Users also want mentions, watchers and attachments.

## Decisions

1. **Comments live in the task body** under a `## Comments` heading. Each entry is a `### <ISO time> · <author>` block followed by its Markdown text. The older `- **time** — text` list entries are still read but never written. Editing a comment is not supported; deleting one is.
2. **Author identity** is the first available of `identity.name` in `task.yaml`, the `TASK_AUTHOR` environment variable, `git config user.name`, and the operating system user name. This identifies, it does not authenticate.
3. **Mentions** are `@name` tokens in comments and task text. They are highlighted and indexed for search; there are no emails or push notifications. **Watchers** are a list of names on the task; the dashboard can filter to tasks you watch.
4. **Attachments** are recorded in the `attachments` field. A `file` attachment is at most 1 MB, has a sanitised name, is stored under `<workspace>/attachments/<task id>/`, is never written through symlinks, is refused for protected names, and is downloaded with `content-disposition: attachment` and `nosniff`. A `link` attachment holds an http or https URL.
5. **Larger files are deferred.** A later server-side storage API may hold files over 1 MB and attach them by link. Until then oversized uploads are rejected with a message that points to link attachments.

## Consequences

- Comment history is plain Markdown that diffs in Git.
- Attachments add a small, bounded write path that needs its own safety tests.
