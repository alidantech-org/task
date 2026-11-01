---
{id: TSK-EA9618BB7702,name: "Content-quality policy: reject scaffold-only tasks and group goal/plan",type: task,status: completed,priority: high,created_at: 2026-11-01T03:18:55.070Z,updated_at: 2026-11-01T03:34:07.870Z,due_at: 2026-11-01,extra: {status_history: [{from: planned,to: completed,at: 2026-11-01T03:34:07.870Z}]}}
---

# Content-quality policy: reject scaffold-only tasks and group goal/plan

## Goal
Stop agents from creating empty or token task files. A task must explain its real purpose, context and expected result, and a group must carry a goal and a plan that the system can read. Moving work out of planned has to fail with a clear explanation when the documents are thin, so that agents fix the documents instead of working around the tool.

## Context
Task files created from a scaffold held only a title, and group plan files held three empty headings. Decision 0015 records the thresholds: at least 150 words, a goal-like section, an acceptance-like section, at least three checkboxes, no empty headings and no placeholder text. Groups need goal.md and plan.md with at least 100 words each. The mode lives in task.yaml and defaults to reject. Completed and archived tasks are exempt so history is not flagged.

## Acceptance checklist
- [x] Parse quality and tracking settings from task.yaml and keep them when settings are rewritten.
- [x] Assess task bodies and group documents against the thresholds and report findings.
- [x] Reject status changes out of planned in reject mode, warn in warn mode and ignore in off mode.
- [x] Create goal.md and plan.md for every new group and expose the goal document id.
- [x] Report findings from validate with a severity so only errors set a failing exit code.
- [x] Accept --body-file, --goal-file and --plan-file so detailed documents can be written in one command.
- [x] Generate the task writing rule and update the agent guides.
