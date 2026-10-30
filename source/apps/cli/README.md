# Task CLI

Scriptable local interface for people and agents. `task` and `tk` share one entry point. Run with `bun run dev:cli`. The CLI provides help, version, JSON metadata and an environment diagnostic; workspace commands are not implemented yet.

Internal imports use `#/…`; imports from other projects use their package names. Human output is terminal-aware, while `--json` remains suitable for scripts.
