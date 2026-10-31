# Task TUI

Task's full-screen, read-only local workspace browser, built with OpenTUI and React. Start it from the CLI with `task -f`, `task --full-screen`, or `task tui`; run it directly during development with `bun run dev:tui`. The CLI passes its resolved workspace root through `TASK_WORKSPACE_ROOT`; direct development use follows the normal `task.yaml` / `tasks/` discovery rules.

The interface provides a four-lane task board, group summaries, Markdown document browsing, Rules and Agent Profile views with on-demand previews, metadata search, explicit refresh, and keyboard help. It uses the shared `@task/workspace` package for summaries and document reads. The interface is read-only: use `task` / `tk` commands to create or update records. Agent execution/orchestration and Activity remain planned; the Agents view only browses Task-managed profile documents.

Keys: `←` / `→` or `h` / `l` change sections; `↑` / `↓` or `j` / `k` select entries; `/` searches visible metadata; `r` refreshes workspace data; `?` opens help; `q` or Escape exits. Internal imports use `#/…`.
