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

## Keep this separate from the Task workspace

By default, `.docs/` contains ordinary engineering documentation and is outside the Task-managed workspace. The Task-managed workspace defaults to `tasks/`, but a repository can select another directory in `task.yaml`. If `.docs/` is explicitly configured as the managed workspace, its Markdown files then follow the Task frontmatter contract.

Avoid maintaining duplicate copies of the same document in both locations. Put contributor and implementation documentation here by convention; put work records and project knowledge managed through Task in the configured workspace.

The documentation is version-controlled with the repository and should be updated alongside the behavior it describes.
