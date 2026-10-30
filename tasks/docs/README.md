---
id: DOC-ENGINEERING-README
name: Engineering documentation guide
type: documentation
tags:
  - engineering
  - repository
---

# Repository documentation

This directory contains documentation about **Task as a software project**: how the product is designed, implemented, developed, operated, and contributed to.

Use this directory for durable repository-level documentation such as:

- Architecture and system design.
- Development setup and contributor guidance.
- Engineering conventions and implementation guides.
- CLI, dashboard, workspace, and agent integration behavior.
- Release, packaging, and operational guides.

Suggested organization as documentation grows:

```text
tasks/docs/
├── architecture/
├── development/
├── guides/
└── reference/
```

Create subdirectories when there is actual content to put in them; do not add empty placeholder trees.

## Managed engineering documentation

`tasks/docs/` is inside this repository's Task-managed workspace. Its Markdown files use Task frontmatter so the local application can discover and present them. Root-level repository Markdown such as `README.md` and `AGENTS.md` remains ordinary Markdown.

Avoid maintaining duplicate copies of the same document in both locations. Put contributor and implementation documentation here, alongside decisions, handoffs, and other work records.

The documentation is version-controlled with the repository and should be updated alongside the behavior it describes.
