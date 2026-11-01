"use client";

import { Button } from "@task/ui";
import { type ChecklistSelector, checklistProgress } from "@task/workspace/documents/checklist";
import { resolveLink } from "@task/workspace/links/resolve";
import { assessTaskBody, defaultQuality } from "@task/workspace/operations/quality";
import {
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DropdownMenu } from "radix-ui";
import { useEffect, useState } from "react";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { MarkdownBody } from "@/components/markdown-body";
import { MarkdownEditor } from "@/components/markdown-editor";
import { TaskChanges } from "@/components/task-changes";
import { TaskChecklist } from "@/components/task-checklist";
import { DatePicker } from "@/components/ui/date-picker";
import { CustomSelect } from "@/components/ui/select";
import { buildLinkContext, internalHref } from "@/lib/link-context";

const tabs = [
  ["overview", "Overview"],
  ["checklist", "Checklist"],
  ["changes", "Changes"],
  ["edit", "Edit"],
  ["docs", "Docs"],
  ["quality", "Quality"],
] as const;
type TabId = (typeof tabs)[number][0];

const statusLabels: Record<string, string> = {
  planned: "Planned",
  "in-progress": "In progress",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
};
const statusColors: Record<string, string> = {
  blocked: "var(--bl)",
  completed: "var(--dn)",
  "in-progress": "var(--ip)",
  planned: "var(--pl)",
};
const expandedKey = "task-sheet-expanded";

function readExpanded(): boolean {
  try {
    return window.localStorage.getItem(expandedKey) === "1";
  } catch {
    return false;
  }
}

export function TaskSheet() {
  const {
    archivedTasks,
    groups,
    workspace,
    records,
    openRecord,
    updateTaskStatus,
    updateTaskDue,
    updateTaskPriority,
    setTaskHiddenFromRecent,
    setTaskArchived,
    deleteRecord,
    setChecklist,
    selected,
    detail,
    saveBody,
    setNotice,
  } = useWorkspaceApp();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [mentions, setMentions] = useState<string[]>([]);
  const open = selected?.type === "task" && detail !== null;
  const taskId = selected?.id;

  useEffect(() => setExpanded(readExpanded()), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Return to the overview whenever another task opens.
  useEffect(() => setTab("overview"), [taskId]);
  useEffect(() => setDraft(detail?.body ?? ""), [detail?.body]);
  useEffect(() => {
    let active = true;
    setMentions([]);
    if (!taskId) return;
    void fetch(`/api/runtime/workspace/search?q=${encodeURIComponent(`[[${taskId}]]`)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as { results?: { id: string }[] };
        if (active && response.ok) setMentions((payload.results ?? []).map((item) => item.id));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [taskId]);

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    try {
      window.localStorage.setItem(expandedKey, next ? "1" : "0");
    } catch {
      // The preference is a convenience only.
    }
  }
  if (!open || !selected || !detail) return null;
  const task = selected;
  const body = detail.body;
  const progress = checklistProgress(body);
  const archived = archivedTasks.some((candidate) => candidate.id === task.id);
  const group = groups.find((item) => task.path.startsWith(`${item.path}/`));
  const quality = workspace?.quality ?? defaultQuality;
  const findings = quality.mode === "off" ? [] : assessTaskBody(body, quality);
  const linkContext = buildLinkContext(workspace, records, task.path);
  const statuses =
    task.status === "archived" ? Object.keys(statusLabels) : Object.keys(statusLabels).slice(0, 4);
  const hasTracking = (task.extra?.tracking?.segments.length ?? 0) > 0;

  async function save() {
    setSaving(true);
    try {
      if (await saveBody(draft)) setTab("overview");
    } finally {
      setSaving(false);
    }
  }
  function openHref(href: string) {
    router.push(href);
  }
  const linked = [...body.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)]
    .map((match) => resolveLink(match[1] ?? "", linkContext))
    .flatMap((target) => {
      const href = internalHref(target);
      return href && target.kind !== "anchor" ? [{ target, href }] : [];
    })
    .filter((entry, index, all) => all.findIndex((other) => other.href === entry.href) === index);
  const groupDocs = [
    ...(group?.goalId ? [{ label: "Group goal", id: group.goalId }] : []),
    ...(group ? [{ label: "Group plan", id: group.id }] : []),
  ];

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (next) return;
        if (tab === "edit" && draft !== body && !window.confirm("Discard unsaved changes?")) return;
        openRecord(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="task-sheet-overlay" />
        <Dialog.Content
          className={`task-sheet ${expanded ? "expanded" : ""}`}
          aria-describedby={undefined}
        >
          <header className="task-sheet-head">
            <div className="min-w-0 flex-1">
              <p className="sub truncate">
                {task.id} · {task.path}
              </p>
              <Dialog.Title asChild>
                <h2>{task.name}</h2>
              </Dialog.Title>
            </div>
            <div className="task-sheet-actions">
              <CustomSelect
                label="Task status"
                value={task.status ?? "planned"}
                onValueChange={(status) => void updateTaskStatus(task, status)}
                options={statuses.map((status) => ({
                  value: status,
                  label: statusLabels[status] ?? status,
                  color: statusColors[status] ?? "var(--pl)",
                }))}
              />
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button variant="ghost" aria-label="More actions">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="task-sheet-menu" align="end" sideOffset={6}>
                    {task.status === "completed" && !archived && (
                      <DropdownMenu.Item
                        onSelect={() =>
                          void setTaskHiddenFromRecent(task, !task.extra?.hidden_from_recent)
                        }
                      >
                        {task.extra?.hidden_from_recent ? (
                          <Eye className="size-4" />
                        ) : (
                          <EyeOff className="size-4" />
                        )}
                        {task.extra?.hidden_from_recent ? "Show in recent" : "Hide in recent"}
                      </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Item onSelect={() => void setTaskArchived(task, !archived)}>
                      {archived ? (
                        <ArchiveRestore className="size-4" />
                      ) : (
                        <Archive className="size-4" />
                      )}
                      {archived ? "Restore" : "Archive"}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="danger"
                      onSelect={() => void deleteRecord({ id: task.id, name: task.name }, "task")}
                    >
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <Button
                variant="ghost"
                aria-label={expanded ? "Shrink task sheet" : "Expand task sheet"}
                onClick={toggleExpanded}
              >
                {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
              <Dialog.Close asChild>
                <Button variant="ghost" aria-label="Close task details">
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
          </header>
          <div className="task-detail-fields">
            <div>
              <span className="fld">Priority</span>
              <CustomSelect
                label="Task priority"
                value={task.priority ?? "medium"}
                onValueChange={(priority) => void updateTaskPriority(task, priority)}
                options={[
                  { value: "high", label: "High", color: "var(--bl)" },
                  { value: "medium", label: "Medium", color: "var(--ip)" },
                  { value: "low", label: "Low", color: "var(--pl)" },
                ]}
              />
            </div>
            <div>
              <span className="fld">Due date</span>
              <DatePicker
                label="Task due date"
                value={task.due_at ?? ""}
                onValueChange={(dueDate) => void updateTaskDue(task, dueDate || null)}
              />
            </div>
            <div>
              <span className="fld">Group</span>
              <p>{group?.name ?? task.project ?? "Ungrouped"}</p>
            </div>
          </div>
          <fieldset className="seg task-sheet-tabs" aria-label="Task sections">
            {tabs.map(([id, label]) => (
              <button
                type="button"
                key={id}
                className={tab === id ? "on" : ""}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
                {id === "checklist" && progress.total > 0
                  ? ` ${progress.completed}/${progress.total}`
                  : ""}
                {id === "quality" && findings.length > 0 ? ` (${findings.length})` : ""}
              </button>
            ))}
          </fieldset>
          <div className="task-sheet-body">
            {tab === "overview" && (
              <MarkdownBody
                body={body}
                className="mdb sm"
                linkContext={linkContext}
                onNavigate={openHref}
                knownWikiLinks={records.map((record) => record.id)}
                onWikiLink={(id) => {
                  const record = records.find((item) => item.id === id);
                  if (record) openRecord(record);
                  else setNotice(`No file named ${id}`);
                }}
                onToggleTask={(index, checked) =>
                  void setChecklist(task, { items: [index] }, checked)
                }
              />
            )}
            {tab === "checklist" && (
              <TaskChecklist
                body={body}
                disabled={saving}
                onChange={(selector: ChecklistSelector, checked) =>
                  void setChecklist(task, selector, checked)
                }
              />
            )}
            {tab === "changes" && (
              <TaskChanges
                taskId={task.id}
                refreshKey={task.contentHash}
                showEmpty
                trackedHint={hasTracking}
              />
            )}
            {tab === "edit" && (
              <>
                <div className="task-edit-bar">
                  <Button
                    variant="outline"
                    className="btn2"
                    onClick={() => {
                      setDraft(body);
                      setTab("overview");
                    }}
                  >
                    <X className="size-4" /> Cancel
                  </Button>
                  <Button
                    className="btn2 pr"
                    disabled={saving || draft === body}
                    onClick={() => void save()}
                  >
                    <Save className="size-4" /> {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
                <MarkdownEditor
                  key={`${task.id}:${detail.contentHash}`}
                  value={draft}
                  onError={setNotice}
                  onChange={setDraft}
                />
              </>
            )}
            {tab === "docs" && (
              <div className="task-docs">
                {[
                  [
                    "Group documents",
                    groupDocs.map((entry) => ({ label: entry.label, id: entry.id })),
                  ],
                  [
                    "Depends on",
                    (task.depends_on ?? []).map((id) => ({
                      label: records.find((record) => record.id === id)?.name ?? id,
                      id,
                    })),
                  ],
                  [
                    "Mentioned in",
                    mentions
                      .filter((id) => id !== task.id)
                      .map((id) => ({
                        label: records.find((record) => record.id === id)?.name ?? id,
                        id,
                      })),
                  ],
                ].map(([title, entries]) => (
                  <section key={String(title)}>
                    <h3>{String(title)}</h3>
                    {(entries as { label: string; id: string }[]).length === 0 ? (
                      <p className="sub">None.</p>
                    ) : (
                      <ul>
                        {(entries as { label: string; id: string }[]).map((entry) => (
                          <li key={`${entry.id}:${entry.label}`}>
                            <a
                              href={`/documents/${encodeURIComponent(entry.id)}`}
                              onClick={(event) => {
                                event.preventDefault();
                                openHref(`/documents/${encodeURIComponent(entry.id)}`);
                              }}
                            >
                              {entry.label}
                            </a>{" "}
                            <span className="sub">{entry.id}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
                <section>
                  <h3>Links in this task</h3>
                  {linked.length === 0 ? (
                    <p className="sub">None.</p>
                  ) : (
                    <ul>
                      {linked.map((entry) => (
                        <li key={entry.href}>
                          <a
                            href={entry.href}
                            onClick={(event) => {
                              event.preventDefault();
                              openHref(entry.href);
                            }}
                          >
                            {entry.target.kind === "file" ? entry.target.path : entry.href}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
            {tab === "quality" && (
              <div className="task-quality">
                <p>
                  Policy: <strong>{quality.mode}</strong> · at least {quality.minTaskWords} words
                  and {quality.minChecklistItems} checkboxes, a Goal and an Acceptance checklist.
                </p>
                {findings.length === 0 ? (
                  <p className="pill">Detailed enough to start</p>
                ) : (
                  <>
                    <p className="pill">Needs more detail</p>
                    <ul>
                      {findings.map((finding) => (
                        <li key={finding.message}>{finding.message}</li>
                      ))}
                    </ul>
                    <Button variant="outline" onClick={() => setTab("edit")}>
                      <Pencil className="size-4" /> Edit task
                    </Button>
                  </>
                )}
                <p className="sub">
                  The group's goal and plan documents are checked too when a task leaves Planned.
                </p>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
