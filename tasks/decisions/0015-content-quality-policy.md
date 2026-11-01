---
id: DEC-0015
name: Content-quality policy for tasks and groups
type: decision
status: accepted
created_at: 2026-11-01
---

# Decision 0015: Content-quality policy for tasks and groups

- **Status:** Accepted
- **Date:** 2026-11-01
- **Scope:** Required content of task files, group goal and plan documents, and how it is enforced

## Context

Agents create task and plan files from scaffolds and leave them empty, or split one piece of work across many tiny files. The tool must push agents to write detailed, purposeful documents, with one task file per piece of work and the steps as checkboxes inside it.

## Decisions

1. **A task is detailed when** it has at least 150 words, a goal-like section (Goal, Context, Purpose or Background), an acceptance-like section (Acceptance, Checklist, Done when or Steps), at least 3 checkboxes, no empty headings and no leftover placeholder text.
2. **A group needs `goal.md` and `plan.md`**, each with at least 100 words and no empty headings. `README.md` is optional. The group's goal is read from `goal.md` so the system and dashboard know it.
3. **Thresholds and mode live in `task.yaml`** under `quality` (`mode`, `minTaskWords`, `minChecklistItems`, `minGroupDocWords`). The default mode is `reject`; `warn` reports without blocking; `off` disables the policy.
4. **Scaffolds are allowed, progress is not.** `task create` and `task group create` write a starting file and accept a full body. Moving a task out of `planned` is rejected in `reject` mode with a message listing every finding and how to fix it. `task validate` reports findings as errors (`reject`) or warnings (`warn`).
5. **Exemptions:** completed and archived tasks, and anything under `_completed/` or `_archived/`, are not assessed, so existing history is not flagged.
6. **Diagnostics carry a severity** (`error` or `warning`); only errors make `task validate` exit non-zero.
7. **Heuristics are a floor, not proof of quality.** Word counts can be padded; required sections, checkbox counts and placeholder detection reduce that, and humans remain the reviewers.

## Consequences

- Existing scaffold-only tasks that are still planned will need real content before they can start.
- The agent-facing documents must state the writing standard and how to resolve rejections.
