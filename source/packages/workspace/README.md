# @task/workspace

Shared local workspace primitives for the CLI and local runtime. The first primitive
provides lexical path containment only; filesystem operations must additionally defend
against symlink escapes and validate the configured managed boundary.

This package must not depend on the local server, browser UI, or hosted API.