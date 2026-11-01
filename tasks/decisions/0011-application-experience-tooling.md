---
id: DEC-0011
name: Next.js web applications, advanced TUI, and polished CLI
type: decision
status: accepted
created_at: 2026-10-31
---

# Decision 0011: Next.js web applications, advanced TUI, and polished CLI

- **Status:** Accepted
- **Date:** 2026-10-31
- **Scope:** Web application framework, terminal interface, CLI presentation, and compatible runtime tooling

## Context

Task has multiple user-facing interfaces: hosted and local browser applications, a scriptable CLI for people and agents, and a full-screen terminal interface. These surfaces should feel intentional and capable rather than remaining minimal starter projects.

## Decisions

1. **Next.js for every web application.** All websites and browser applications use Next.js App Router. This includes both apps/local and apps/site. Do not introduce Vite as the web application framework.
2. **Keep local runtime separate.** The local Next.js dashboard is a browser presentation layer. The local Bun runtime remains a separate process and owns controlled filesystem access, workspace-scoped operations, local HTTP/WebSocket transport, reconciliation, and runtime security. Next.js must not weaken this boundary.
3. **Advanced TUI with OpenTUI.** Use OpenTUI Core and its React bindings for native terminal rendering, responsive layouts, keyboard navigation, focus, selection, and rich interactive views. The TUI is a real interactive application, not a menu printed as static text.
4. **TUI reuses the workspace engine.** All authoritative task/document behavior comes from the shared workspace engine. TUI owns terminal presentation and interaction only; it must not create a second domain model or independent storage.
5. **Polished CLI presentation.** Use picocolors for terminal-aware colour and @clack/prompts for accessible interactive prompts, selections, confirmations, and progress. Provide carefully formatted help, status, errors, and future command output.
6. **Preserve automation ergonomics.** CLI supports machine-readable output such as JSON, stable exit codes, predictable errors, and non-interactive operation. Do not force prompts or colour into scripts/pipes. task and tc remain equivalent command names.
7. **Bun runtime compatibility.** OpenTUI requires Bun 1.3.14 or later for the supported native runtime. Pin the repository packageManager metadata accordingly and keep all TypeScript projects under the root Bun workspace.
8. **Keep Flutter independent.** Flutter/Dart remains outside the Bun workspace and uses Flutter tooling. It is not a website and is not subject to the Next.js requirement.
9. **Use persistent App Router route-group layouts.** Put browser screens under `src/app/(app)/` and shared application chrome in that group's `layout.tsx`. Keep API route handlers in the sibling `src/app/api/` tree. Prefer explicit section routes and use dynamic segments for resource-specific pages; route groups must not change public URLs.

## Consequences

- The local dashboard and hosted site are separate Next.js applications.
- Vite is removed from these browser application foundations.
- The TUI gains a native renderer and React component model.
- CLI output can be expressive for humans without sacrificing agent/script compatibility.
- Root Bun installation manages the TypeScript application dependencies, while Flutter remains independently managed.

## Implementation status

The initial scaffold migration installs and configures these foundations and provides starter interfaces. It does not claim complete website, CLI, TUI, local runtime, or workspace functionality. Full product workflows remain separate implementation phases.

## References

- [Next.js documentation](https://nextjs.org/docs)
- [OpenTUI React bindings](https://opentui.com/docs/bindings/react/)
- [OpenTUI runtime support](https://opentui.com/docs/getting-started/runtime-support/)
- [Clack prompts](https://github.com/bombshell-dev/clack)
