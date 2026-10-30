# Task API

Standalone NestJS modular-monolith application for Task Cloud.

This is an executable service foundation with a health endpoint only. Domain modules,
authentication, persistence, authorization, and synchronization are intentionally not
stubbed out before their contracts are designed.

Run from the repository root with `bun run dev:api`. The default port is 3000.