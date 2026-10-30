# Task Site

Hosted Next.js App Router client foundation. Routes and layouts live in `src/app`; application components and shadcn primitives live in `src/components`. Tailwind CSS v4 and the shadcn/ui Radix Nova preset are configured in this app independently from the local dashboard.

Run with `bun run dev:site`. The page checks the Task API health endpoint server-side; set `TASK_API_HEALTH_URL` to override its default. Authentication and hosted workspace workflows are not implemented.
