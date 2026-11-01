"use client";

import { Button } from "@task/ui";
import { type ChecklistSelector, checklistProgress } from "@task/workspace/documents/checklist";
import { resolveLink } from "@task/workspace/links/resolve";
import { assessTaskBody, defaultQuality } from "@task/workspace/operations/quality";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Eye,
  EyeOff,
  FileText,
  GitCompare,
  History,
  LayoutDashboard,
  ListTree,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DropdownMenu } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { ChangeViewer, type ViewerTarget } from "@/components/change-viewer";
import { DocumentEditorSheet } from "@/components/document-editor-sheet";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { MarkdownBody } from "@/components/markdown-body";
import { TaskActivity } from "@/components/task-activity";
import { TaskChanges } from "@/components/task-changes";
import { TaskComments } from "@/components/task-comments";
import { TaskFiles } from "@/components/task-files";
import { TaskOverview } from "@/components/task-overview";
import { TaskProperties } from "@/components/task-properties";
import { TaskSubtasks } from "@/components/task-subtasks";
import { DatePicker } from "@/components/ui/date-picker";
import { CustomSelect } from "@/components/ui/select";
import { groupForTask } from "@/lib/group";
import { buildLinkContext, internalHref } from "@/lib/link-context";
import {
  clampStoredWidth,
  defaultSheetWidth,
  minSheetWidth,
  resolveSheetWidth,
  wideSheetWidth,
} from "@/lib/sheet-width";
import { describeDue } from "@/lib/task-analytics";

const tabs = [
  ["overview", "Overview", LayoutDashboard],
  ["details", "Details", FileText],
  ["subtasks", "Subtasks", ListTree],
  ["comments", "Comments", MessageSquare],
  ["activity", "Activity", History],
  ["changes", "Changes", GitCompare],
  ["edit", "Edit", Pencil],
  ["docs", "Docs", BookOpen],
  ["files", "Files", Paperclip],
  ["quality", "Quality", ShieldCheck],
] as const;
type TabId = (typeof tabs)[number][0];
/** The tabs always on the bar; the rest live in the More menu. */
const mainTabs: readonly TabId[] = ["overview", "details", "subtasks", "comments"];

/** Below these sheet widths the date/status editors, then the tabs, collapse to icons. */
const compactEditorsBelow = 720;
const compactTabsBelow = 520;

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
const widthKey = "task-sheet-width";

function readWidth(): number {
  try {
    return clampStoredWidth(window.localStorage.getItem(widthKey), window.innerWidth);
  } catch {
    return defaultSheetWidth;
  }
}

function storeWidth(width: number): void {
  try {
    window.localStorage.setItem(widthKey, String(width));
  } catch {
    // The preference is a convenience only.
  }
}

const priorityLabels: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

function formatDate(value: string | undefined): string {
  if (!value) return "No due date";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
        date,
      );
}

export function TaskSheet() {
  const {
    archivedTasks,
    allGroups,
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
    refresh,
    updateTaskFields,
    createSubtask,
    allTasks,
    groups,
    selected,
    detail,
    saveBody,
    setNotice,
  } = useWorkspaceApp();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [width, setWidth] = useState(defaultSheetWidth);
  const [resizing, setResizing] = useState<"idle" | "drag" | "hide">("idle");
  const widthBeforeDrag = useRef(defaultSheetWidth);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewer, setViewer] = useState<ViewerTarget | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [mentions, setMentions] = useState<string[]>([]);
  const [changeCount, setChangeCount] = useState(0);
  const open = selected?.type === "task" && detail !== null;
  const taskId = selected?.id;
  const segmentCount = selected?.extra?.tracking?.segments.length ?? 0;
  const contentHash = selected?.contentHash;

  useEffect(() => setWidth(readWidth()), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Return to the overview whenever another task opens.
  useEffect(() => {
    setTab("overview");
    setViewer(null);
    setEditorOpen(false);
  }, [taskId]);
  useEffect(() => {
    if (tab === "edit") setEditorOpen(true);
  }, [tab]);
  useEffect(() => setDraft(detail?.body ?? ""), [detail?.body]);
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload the count when the task changes or the Changes tab is shown.
  useEffect(() => {
    let active = true;
    setChangeCount(0);
    if (!taskId || segmentCount === 0) return;
    void fetch(`/api/runtime/workspace/task/${encodeURIComponent(taskId)}/changes`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          changes?: { available: boolean; totals?: { files: number } };
        };
        if (active && response.ok && payload.changes?.available)
          setChangeCount(payload.changes.totals?.files ?? 0);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [taskId, segmentCount, contentHash, tab === "changes"]);

  function closeSheet() {
    openRecord(null);
  }
  const expanded = width > 800;
  function toggleExpanded() {
    const next = expanded
      ? defaultSheetWidth
      : resolveSheetWidth(wideSheetWidth, window.innerWidth).width;
    setWidth(next);
    storeWidth(next);
  }
  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    widthBeforeDrag.current = width;
    let latest = resolveSheetWidth(width, window.innerWidth);
    setResizing("drag");
    const move = (moveEvent: PointerEvent) => {
      latest = resolveSheetWidth(window.innerWidth - moveEvent.clientX, window.innerWidth);
      setWidth(latest.width);
      setResizing(latest.hide ? "hide" : "drag");
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      setResizing("idle");
      if (latest.hide) {
        setWidth(widthBeforeDrag.current);
        closeSheet();
      } else storeWidth(latest.width);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }
  function resizeWithKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowLeft" ? 24 : event.key === "ArrowRight" ? -24 : 0;
    if (!step) return;
    event.preventDefault();
    const next = resolveSheetWidth(width + step, window.innerWidth);
    setWidth(next.hide ? minSheetWidth : next.width);
    storeWidth(next.hide ? minSheetWidth : next.width);
  }
  if (!open || !selected || !detail) return null;
  const task = selected;
  const body = detail.body;
  const effectiveWidth = Math.min(width, viewportWidth || width);
  const progress = checklistProgress(detail?.body ?? "");
  const remainingSteps = progress.total - progress.completed;
  const compact = effectiveWidth < compactTabsBelow;
  const compactEditors = effectiveWidth < compactEditorsBelow;
  const archived = archivedTasks.some((candidate) => candidate.id === task.id);
  const group = groupForTask(task, allGroups);
  const quality = workspace?.quality ?? defaultQuality;
  const findings = quality.mode === "off" ? [] : assessTaskBody(body, quality);
  const linkContext = buildLinkContext(workspace, records, task.path);
  const statuses =
    task.status === "archived" ? Object.keys(statusLabels) : Object.keys(statusLabels).slice(0, 4);
  const segments = task.extra?.tracking?.segments ?? [];
  const due = describeDue(task.due_at, task.status, Date.now());

  async function save() {
    setSaving(true);
    try {
      if (await saveBody(draft)) {
        setEditorOpen(false);
        setTab("details");
      }
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
  const childTasks = allTasks.filter((item) => item.parent === task.id);
  const parentTask = allTasks.find((item) => item.id === task.parent);
  const attachmentList = task.attachments ?? [];
  const assignees = [
    ...new Set(
      allTasks.map((item) => item.assignee).filter((name): name is string => Boolean(name)),
    ),
  ];
  const counts: Partial<Record<TabId, number>> = {
    subtasks: childTasks.length,
    comments: task.commentCount ?? 0,
    files: attachmentList.length,
  };
  const moreBadge = changeCount + findings.length + (counts.files ?? 0);
  const checklistChange = (selector: ChecklistSelector, checked: boolean) =>
    void setChecklist(task, selector, checked);

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) closeSheet();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="task-sheet-overlay" />
        <Dialog.Content
          className={`task-sheet ${resizing === "idle" ? "" : "resizing"} ${resizing === "hide" ? "will-hide" : ""} ${compact ? "compact" : ""}`}
          style={{ width: `min(${width}px, 100vw)` }}
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => {
            if (!viewer) return;
            event.preventDefault();
            setViewer(null);
          }}
        >
          {/* biome-ignore lint/a11y/useSemanticElements: the WAI-ARIA window splitter pattern needs a focusable separator */}
          <div
            className="task-sheet-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize task sheet"
            aria-valuenow={width}
            aria-valuemin={minSheetWidth}
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={resizeWithKeyboard}
          />
          {viewer ? (
            <>
              <Dialog.Title className="sr-only">{viewer.path}</Dialog.Title>
              <ChangeViewer
                target={viewer}
                onBack={() => setViewer(null)}
                onMode={(mode) => setViewer({ ...viewer, mode })}
              />
            </>
          ) : (
            <>
              <header className="task-sheet-head">
                <div className="min-w-0 flex-1">
                  <Dialog.Title asChild>
                    <h2 className="task-sheet-title" title={task.name}>
                      {task.name}
                      {group ? <span className="task-sheet-group"> ({group.name})</span> : null}
                    </h2>
                  </Dialog.Title>
                  <p className="task-sheet-meta">
                    <span className={`due-${due.tone}`}>{formatDate(task.due_at)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="task-sheet-status">
                      <i style={{ background: statusColors[task.status ?? "planned"] }} />
                      {statusLabels[task.status ?? "planned"] ?? task.status}
                    </span>
                    <span aria-hidden="true">·</span>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          type="button"
                          className="task-sheet-priority"
                          aria-label="Change priority"
                        >
                          {priorityLabels[task.priority ?? "medium"]} priority
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="task-sheet-menu"
                          align="start"
                          sideOffset={6}
                        >
                          {Object.entries(priorityLabels).map(([value, label]) => (
                            <DropdownMenu.Item
                              key={value}
                              onSelect={() => void updateTaskPriority(task, value)}
                            >
                              {label}
                            </DropdownMenu.Item>
                          ))}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </p>
                </div>
                <div className="task-sheet-actions">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="sheet-icon"
                        aria-label="More actions"
                      >
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
                          onSelect={() =>
                            void deleteRecord({ id: task.id, name: task.name }, "task")
                          }
                        >
                          <Trash2 className="size-4" /> Delete
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sheet-icon"
                    aria-label={expanded ? "Shrink task sheet" : "Expand task sheet"}
                    onClick={toggleExpanded}
                  >
                    {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sheet-icon"
                    aria-label="Close task details"
                    onClick={closeSheet}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </header>
              <div className="task-sheet-subhead">
                <fieldset className="seg task-sheet-tabs" aria-label="Task sections">
                  {tabs
                    .filter(([id]) => mainTabs.includes(id))
                    .map(([id, label, Icon]) => (
                      <button
                        type="button"
                        key={id}
                        className={tab === id ? "on" : ""}
                        aria-pressed={tab === id}
                        aria-label={compact ? label : undefined}
                        title={compact ? label : undefined}
                        onClick={() => setTab(id)}
                      >
                        {compact ? <Icon className="size-4" /> : label}
                        {counts[id] ? (
                          <b className="tab-count" title="Items">
                            {counts[id]}
                          </b>
                        ) : null}
                        {id === "overview" && remainingSteps > 0 ? (
                          <b className="tab-count" title="Steps not done">
                            {remainingSteps}
                          </b>
                        ) : null}
                      </button>
                    ))}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        className={mainTabs.includes(tab) ? "" : "on"}
                        aria-label="More sections"
                        title="More sections"
                      >
                        {mainTabs.includes(tab) || compact
                          ? null
                          : tabs.find(([id]) => id === tab)?.[1]}
                        <MoreHorizontal className="size-4" />
                        {mainTabs.includes(tab) && moreBadge > 0 ? (
                          <b className="tab-count">{moreBadge}</b>
                        ) : null}
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="task-sheet-menu"
                        align="start"
                        sideOffset={6}
                      >
                        {tabs
                          .filter(([id]) => !mainTabs.includes(id))
                          .map(([id, label, Icon]) => {
                            const badge =
                              id === "quality"
                                ? findings.length
                                : id === "changes"
                                  ? changeCount
                                  : (counts[id] ?? 0);
                            return (
                              <DropdownMenu.Item
                                key={id}
                                className={tab === id ? "is-current" : ""}
                                onSelect={() => setTab(id)}
                              >
                                <Icon className="size-4" /> {label}
                                {badge > 0 ? <b className="tab-count">{badge}</b> : null}
                              </DropdownMenu.Item>
                            );
                          })}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </fieldset>
                <div className="task-sheet-edit">
                  <DatePicker
                    label="Task due date"
                    compact={compactEditors}
                    value={task.due_at ?? ""}
                    onValueChange={(dueDate) => void updateTaskDue(task, dueDate || null)}
                  />
                  <CustomSelect
                    label="Task status"
                    compact={compactEditors}
                    value={task.status ?? "planned"}
                    onValueChange={(status) => void updateTaskStatus(task, status)}
                    options={statuses.map((status) => ({
                      value: status,
                      label: statusLabels[status] ?? status,
                      color: statusColors[status] ?? "var(--pl)",
                    }))}
                  />
                </div>
              </div>
              <div className="task-sheet-body">
                {tab === "overview" && (
                  <TaskOverview
                    body={body}
                    status={task.status}
                    dueAt={task.due_at}
                    createdAt={task.created_at}
                    updatedAt={task.updated_at}
                    history={task.extra?.status_history}
                    segments={segments}
                    findings={findings.length}
                    groupName={group?.name}
                    disabled={saving}
                    onReadMore={() => setTab("details")}
                    onShowChanges={() => setTab("changes")}
                    onChecklist={checklistChange}
                  />
                )}
                {tab === "overview" && (
                  <section className="task-overview">
                    <h3 className="ov-title">Properties</h3>
                    <TaskProperties
                      task={task}
                      candidates={allTasks.filter((item) => item.id !== task.id)}
                      groups={groups}
                      assignees={assignees}
                      currentGroupId={group?.id}
                      onSave={(patch) => updateTaskFields(task, patch)}
                    />
                  </section>
                )}
                {tab === "subtasks" && (
                  <TaskSubtasks
                    task={task}
                    subtasks={childTasks}
                    parent={parentTask}
                    onOpen={(item) => openRecord(item)}
                    onAdd={(title) => createSubtask(task, title)}
                  />
                )}
                {tab === "comments" && (
                  <TaskComments
                    taskId={task.id}
                    onChanged={() => void refresh()}
                    onNotice={setNotice}
                  />
                )}
                {tab === "activity" && (
                  <TaskActivity taskId={task.id} refreshKey={task.contentHash} />
                )}
                {tab === "files" && (
                  <TaskFiles
                    taskId={task.id}
                    attachments={attachmentList}
                    onChanged={() => void refresh()}
                    onNotice={setNotice}
                  />
                )}
                {tab === "details" && (
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
                    onToggleTask={(index, checked) => checklistChange({ items: [index] }, checked)}
                  />
                )}
                {tab === "changes" && (
                  <TaskChanges
                    taskId={task.id}
                    refreshKey={task.contentHash}
                    showEmpty
                    trackedHint={segments.length > 0}
                    onView={setViewer}
                  />
                )}
                {tab === "edit" && (
                  <div className="task-edit-launch">
                    <p className="sub">The editor opens in its own full-height sheet.</p>
                    <Button className="btn2 pr" onClick={() => setEditorOpen(true)}>
                      <Pencil className="size-4" /> Open editor
                    </Button>
                  </div>
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
                      Policy: <strong>{quality.mode}</strong> · at least {quality.minTaskWords}{" "}
                      words and {quality.minChecklistItems} checkboxes, a Goal and an Acceptance
                      checklist.
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
                      The group's goal and plan documents are checked too when a task leaves
                      Planned.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
          {editorOpen && (
            <DocumentEditorSheet
              title={task.name}
              path={task.path}
              value={draft}
              savedValue={body}
              onChange={setDraft}
              onSave={save}
              onError={setNotice}
              saving={saving}
              onClose={() => {
                setEditorOpen(false);
                if (tab === "edit") setTab("details");
              }}
              preview={
                <MarkdownBody
                  body={draft}
                  className="mdb"
                  linkContext={linkContext}
                  onNavigate={openHref}
                />
              }
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
