---
{id: GRP-8A82255470BC,name: "Auto tracking, task sheet and content quality",type: documentation,extra: {created_at: 2026-11-01T03:18:55.003Z}}
---

# Auto tracking, task sheet and content quality plan

## Approach
Work in four ordered slices, each shipped with tests and a commit on develop. First record the decisions so later work has a reference. Then build the content-quality policy and the shared checklist engine in the workspace package, because the dashboard and the command line both depend on them. Next move tracking into a private per-project git repository under the tool data directory so it is automatic and independent of the project's own repository. Finally rebuild the dashboard task sheet on top of those pieces and verify it in the running application.

## Milestones
1. Decisions 0014 and 0015 accepted and linked from the architecture documentation.
2. Quality policy enforced on status changes and reported by validate with a severity.
3. Checklist commands and runtime routes available to agents and the dashboard.
4. Automatic tracking in the private store with limits, isolation and compatibility for old segments.
5. New task sheet with every tab working and closable by button, escape and backdrop.

## Risks and open questions
Existing planned tasks written as scaffolds will be rejected until they are filled in, which is intended but will surprise users. Word counts can be padded, so required sections and checkbox counts back them up. The private store grows without pruning, which is recorded as follow-up work.
