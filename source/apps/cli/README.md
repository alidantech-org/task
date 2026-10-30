# Task CLI

Scriptable local interface for people and AI agents. Both `task` and `tk` resolve
to the same entry point. The CLI remains usable without the local dashboard/runtime.

The CLI is part of the root Bun workspace. Run it from the repository root with
`bun run dev:cli`. Workspace commands will be connected to shared workspace
operations as those contracts are implemented.