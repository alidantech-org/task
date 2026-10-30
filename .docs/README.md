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
.docs/
├── architecture/
├── development/
├── guides/
└── reference/
```

Create subdirectories when there is actual content to put in them; do not add empty placeholder trees.

## Keep this separate from `tasks/`

- `.docs/` explains the Task software project and how it works.
- `tasks/` is the Task-managed workspace used to track work and maintain the project's evolving context: task records, product research, requirements, decisions, handoffs, and related project knowledge.

Avoid maintaining duplicate copies of the same document in both locations. Put contributor and implementation documentation in `.docs/`; put work records and project knowledge managed through Task in `tasks/`.

The documentation is version-controlled with the repository and should be updated alongside the behavior it describes.
