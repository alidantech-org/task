# Task Local

The local product consists of a Next.js App Router dashboard and a separate Bun runtime. App routes and local interactions live in `src/app` and `src/components`; shared design tokens and UI primitives live in `@task/ui`.

- Both processes: `bun run dev:local`
- Runtime: `bun run dev:local:runtime` (loopback port 4317)
- Dashboard: `bun run dev:local:web` (port 5173)
- `TASK_LOCAL_PORT` selects the runtime port.
- Set `TASK_WORKSPACE_ROOT` to a managed workspace directory to select it explicitly; otherwise the runtime discovers the nearest Task project from its working directory. The dashboard's first server render reads the selected project's runtime snapshot, then the browser continues through the same-origin API proxy.

Tailwind CSS v4 uses shared tokens and primitives from `@task/ui`. The dashboard accesses workspace snapshots, full-text search, validation and refresh through the local runtime via a same-origin Next.js proxy. Task creation, group creation, task status/date updates and Markdown source editing use shared workspace operations with validation and stale-edit conflict checks. Trusted-project switching and live WebSocket updates are not implemented yet.

Task status changes made through the CLI or dashboard append typed `extra.status_history` entries to task metadata. Existing tasks begin tracking on their next status change; prior timestamps are not inferred.
