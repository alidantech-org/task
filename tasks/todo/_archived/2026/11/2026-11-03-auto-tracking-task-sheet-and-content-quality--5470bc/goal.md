---
{id: DOC-B3528AA8642E,name: "Auto tracking, task sheet and content quality goal",type: documentation}
---

# Auto tracking, task sheet and content quality goal

## Goal
Make Task trustworthy as the shared project tool for people and AI agents. Three gaps stand in the way today. Agents create scaffold-only task and plan files and never fill them in, so the workspace fills with empty records that say nothing about purpose or scope. Change tracking exists but is opt-in, only works inside git repositories and writes into the project's own repository. The dashboard task panel is a narrow drawer that cannot show diffs, structured checklists or related documents in a usable way.

## Success criteria
- A planned task or group document that is only a scaffold cannot be started, and the rejection explains exactly what to write.
- Every task records its file changes automatically between entering and leaving in-progress, with or without git, and nothing is written inside the project.
- The task sheet is closable, expandable and blurred over the page, with tabs for overview, checklist, changes, editing, related documents and quality.
- Agents can read and tick checkboxes from the command line, and the generated guidance tells them the writing standard.

## Scope
In scope: the workspace package, CLI, runtime and dashboard. Out of scope: the terminal interface diff view, split diffs and pruning the private snapshot store.
