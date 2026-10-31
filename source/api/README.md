# Task API

NestJS modular-monolith API foundation. Bun runs and bundles the service; imports use `#/…` aliases without Node-specific extensions. Nest metadata decorators are registered directly to retain compatibility with the Bun bundler.

- Development: `bun run dev:api`
- Production build/start: `bun run build`, then `bun run --filter @task/api start`
- Liveness: `GET /api/v1/health/live`
- Readiness: `GET /api/v1/health/ready`
- OpenAPI: `/api/docs`

Configuration: `PORT` (default `3000`), `HOST` (default `127.0.0.1`), comma-separated `CORS_ORIGIN` (disabled by default), and `READINESS_ENABLED` (default enabled). There are no external dependencies to probe yet; readiness reports unready when explicitly disabled. Authentication, persistence, authorization and synchronization remain unimplemented.
