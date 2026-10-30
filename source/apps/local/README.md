# Task Local

The local product consists of a Next.js App Router dashboard and a separate Bun runtime. App Router routes, layouts, design tokens, and UI code live in `src/app` and `src/components`; shadcn-generated primitives live in `src/components/ui`.

- Both processes: `bun run dev:local`
- Runtime: `bun run dev:local:runtime` (loopback port 4317)
- Dashboard: `bun run dev:local:web` (port 5173)
- `TASK_LOCAL_PORT` selects the runtime port.
- Set `TASK_WORKSPACE_ROOT` to an already resolved local workspace path to let the CLI, TUI, and local runtime build/use the shared in-memory Markdown index. The runtime continues to expose health routes only; it does not return indexed workspace data to the browser.

Tailwind CSS v4 and the shadcn/ui Radix Nova preset use the app's `components.json` and `src/app/globals.css`. The dashboard checks runtime health server-side and does not access workspace files. Workspace discovery is currently a local runtime/CLI/TUI foundation; dashboard document views are not implemented.
