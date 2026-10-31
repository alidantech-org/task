# Task Local

The local product consists of a Next.js App Router dashboard and a separate Bun runtime. App routes and local interactions live in `src/app` and `src/components`; shared design tokens and UI primitives live in `@task/ui`.

- Both processes: `bun run dev:local`
- Runtime: `bun run dev:local:runtime` (loopback port 4317)
- Dashboard: `bun run dev:local:web` (port 5173)
- `TASK_LOCAL_PORT` selects the runtime port.
- Set `TASK_WORKSPACE_ROOT` to a project root to select it explicitly; otherwise the runtime discovers the nearest Task project when started from inside one. It maintains the shared in-memory Markdown index.

Tailwind CSS v4 uses shared tokens and primitives from `@task/ui`. The dashboard accesses workspace snapshots, full-text search, validation and refresh through the local runtime via a same-origin Next.js proxy. Task creation, group creation and task status/date updates use shared workspace operations with validation and stale-edit conflict checks. Document editing, trusted-project switching and live WebSocket updates are not implemented yet.
