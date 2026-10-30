# Task Local

Local runtime and browser dashboard. The runtime binds to loopback and currently exposes
only a health endpoint; workspace-scoped operations, origin/capability protection,
filesystem reconciliation, and WebSocket updates must be implemented before exposing
workspace data or mutations.

- Runtime: `bun run dev:local` (port 4317, loopback only)
- Dashboard: `bun run dev:local:web` (Vite on 127.0.0.1:5173)

The dashboard and runtime are separate processes in this foundation. The CLI integration
and coordinated lifecycle are a later step.