"use client";

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  InputGroup,
  InputGroupInput,
  Separator,
  Sidebar,
} from "@task/ui";
import {
  Activity,
  AlertTriangle,
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleDot,
  Clock3,
  Command,
  FileText,
  FolderKanban,
  Gauge,
  Laptop,
  LayoutDashboard,
  ListTodo,
  Moon,
  PanelLeftClose,
  Plus,
  Search,
  Sun,
  Timer,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BoardTask, CalendarView, StatusDropZone } from "@/components/calendar";
import { dateKey } from "@/lib/calendar";
import { taskDropUpdate } from "@/lib/drop-mutation";
import {
  clampSidebarWidth,
  completionWeek,
  isArchivedTask,
  sortCompletedTasks,
  type StatusChange,
  sidebarResize,
} from "@/lib/overview";

type RecordItem = {
  path: string;
  id: string;
  name: string;
  type: string;
  tags: string[];
  status?: string;
  priority?: string;
  assignee?: string;
  project?: string;
  start_at?: string;
  due_at?: string;
  created_at?: string;
  updated_at?: string;
  archived_at?: string;
  extra?: { status_history?: readonly StatusChange[] };
  size: number;
  modifiedAt: number;
  contentHash: string;
};
type Group = {
  id: string;
  name: string;
  slug: string;
  path: string;
  archived: boolean;
  total: number;
  completed: number;
};
type Workspace = {
  projectName: string;
  projectRoot: string;
  workspaceRoot: string;
  workspaceDirectory: string;
  source: string;
  scannedAt: number;
  groups: Group[];
  overview: {
    tasks: number;
    planned: number;
    inProgress: number;
    blocked: number;
    completed: number;
    documents: number;
    diagnostics: number;
    recent: RecordItem[];
  };
  documents: RecordItem[];
  diagnostics: Array<{ path: string; message: string; category?: string }>;
};
type SearchResult = { path: string; id: string; name: string; type: string; snippet: string };
type AppProps = {
  runtimeStatus: "connected" | "offline";
  workspace: Record<string, unknown> | null;
  workspaceError?: string | null;
};
type ThemeChoice = "system" | "light" | "dark";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Tasks", icon: ListTodo },
  { label: "Groups", icon: FolderKanban },
  { label: "Documents", icon: FileText },
];
const operations = [
  { label: "Agent prompts", icon: BookOpen },
  { label: "Activity", icon: Activity },
  { label: "Workspace health", icon: Gauge },
];
const statuses = ["planned", "in-progress", "blocked", "completed"] as const;
const statusNames: Record<string, string> = {
  planned: "Planned",
  "in-progress": "In progress",
  blocked: "Blocked",
  completed: "Completed",
};

function statusVariant(status?: string): "success" | "warning" | "destructive" | "secondary" {
  if (status === "completed") return "success";
  if (status === "in-progress") return "warning";
  if (status === "blocked") return "destructive";
  return "secondary";
}
function formatDate(date?: string): string {
  if (!date) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date.slice(0, 10)}T12:00:00`));
}
function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof CircleDot;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/70 px-2 py-4">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      </div>
      <span className="grid size-10 place-items-center rounded-xl bg-secondary text-muted-foreground">
        <Icon className="size-4" />
      </span>
    </div>
  );
}
export function App({
  runtimeStatus,
  workspace: rawWorkspace,
  workspaceError: initialWorkspaceError = null,
}: AppProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(rawWorkspace as Workspace | null);
  const [connectionStatus, setConnectionStatus] = useState(runtimeStatus);
  const [section, setSection] = useState("Overview");
  const [taskView, setTaskView] = useState<"List" | "Board" | "Calendar">("List");
  const [taskFilter, setTaskFilter] = useState<string | null>(null);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [detail, setDetail] = useState<{ body: string; contentHash: string } | null>(null);
  const [editingDocument, setEditingDocument] = useState(false);
  const [documentDraft, setDocumentDraft] = useState("");
  const [savingDocument, setSavingDocument] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [workspaceError, setWorkspaceError] = useState(initialWorkspaceError);
  const [sidebarReady, setSidebarReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [group, setGroup] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const records = workspace?.documents ?? [];
  const allTasks = records.filter((item) => item.type === "task");
  const completedTasks = useMemo(() => sortCompletedTasks(allTasks), [allTasks]);
  const tasks = records.filter(
    (item) => item.type === "task" && !item.path.startsWith("todo/_archive/"),
  );
  const completionByDay = useMemo(() => completionWeek(allTasks), [allTasks]);
  const completedThisWeek = completionByDay.reduce((total, day) => total + day.count, 0);
  const upcomingCount = tasks.filter((task) => {
    if (!task.due_at || task.status === "completed") return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const through = new Date(today);
    through.setDate(through.getDate() + 7);
    return task.due_at >= dateKey(today) && task.due_at <= dateKey(through);
  }).length;
  const maxCompletion = Math.max(1, ...completionByDay.map((day) => day.count));
  const draggingSidebar = useRef({ pointerId: -1, left: 0 });
  const visibleTasks = useMemo(() => {
    if (!taskFilter) return tasks;
    if (taskFilter === "completed") return completedTasks;
    if (taskFilter === "due-soon") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const through = new Date(today);
      through.setDate(through.getDate() + 7);
      const start = dateKey(today);
      const end = dateKey(through);
      return tasks.filter((task) => task.due_at && task.due_at >= start && task.due_at <= end);
    }
    return tasks.filter((task) => task.status === taskFilter);
  }, [completedTasks, tasks, taskFilter]);
  const docs = records.filter((item) => item.type !== "task");
  const themeIcons = { system: Laptop, light: Sun, dark: Moon };
  const ThemeIcon = themeIcons[theme];

  useEffect(() => {
    const stored = window.localStorage.getItem("task-theme");
    const choice: ThemeChoice = stored === "light" || stored === "dark" ? stored : "system";
    setTheme(choice);
    applyTheme(choice);
  }, []);
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme("system");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!query.trim()) {
        setSearchResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      void fetch(`/api/runtime/workspace/search?q=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            results?: SearchResult[];
            error?: { message?: string };
          };
          if (!response.ok) throw new Error(payload.error?.message ?? "Search failed");
          if (active) setSearchResults(payload.results ?? []);
        })
        .catch((error: unknown) => {
          if (active) setNotice(error instanceof Error ? error.message : "Search failed");
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setCollapsed((value) => !value);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setMobileNav(false);
        setProjectSwitcherOpen(false);
        if (dialog) setDialog(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("task-sidebar-collapsed") === "true");
    const storedWidth = Number(window.localStorage.getItem("task-sidebar-width"));
    if (Number.isFinite(storedWidth) && storedWidth > 0)
      setSidebarWidth(clampSidebarWidth(storedWidth));
    setSidebarReady(true);
  }, []);
  useEffect(() => {
    if (!sidebarReady) return;
    window.localStorage.setItem("task-sidebar-collapsed", String(collapsed));
    window.localStorage.setItem("task-sidebar-width", String(sidebarWidth));
  }, [collapsed, sidebarReady, sidebarWidth]);
  useEffect(() => {
    if (workspace) return;
    void fetch("/api/runtime/workspace", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          workspace?: Workspace;
          error?: { message?: string };
        };
        if (!response.ok) throw new Error(payload.error?.message ?? "Workspace unavailable");
        if (payload.workspace) {
          setWorkspace(payload.workspace);
          setWorkspaceError(null);
          setConnectionStatus("connected");
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Workspace unavailable";
        setConnectionStatus("offline");
        setWorkspaceError(message);
      });
  }, [workspace]);
  useEffect(() => {
    let active = true;
    if (!selected) {
      setDetail(null);
      setEditingDocument(false);
      return;
    }
    setDetail(null);
    setEditingDocument(false);
    void fetch(`/api/runtime/workspace/document/${encodeURIComponent(selected.id)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          document?: { body: string; contentHash: string };
          error?: { message?: string };
        };
        if (!response.ok) throw new Error(payload.error?.message ?? "Could not load document");
        if (active) {
          setDetail(payload.document ?? null);
          setDocumentDraft(payload.document?.body ?? "");
        }
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "Could not load document");
      });
    return () => {
      active = false;
    };
  }, [selected]);

  async function saveDocument(): Promise<void> {
    if (!selected || !detail) return;
    setSavingDocument(true);
    try {
      const response = await fetch(
        `/api/runtime/workspace/document/${encodeURIComponent(selected.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: documentDraft, expectedHash: detail.contentHash }),
        },
      );
      const payload = (await response.json()) as {
        document?: { body: string; contentHash: string };
        workspace?: Workspace;
        error?: { message?: string };
      };
      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(
            "This Markdown file changed on disk. Copy your draft, reload the document, then reapply your changes.",
          );
        }
        throw new Error(payload.error?.message ?? `Could not save document (${response.status})`);
      }
      if (payload.workspace) setWorkspace(payload.workspace);
      if (payload.document) setDetail(payload.document);
      setEditingDocument(false);
      setNotice("Markdown saved");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save Markdown");
    } finally {
      setSavingDocument(false);
    }
  }

  async function acceptWorkspaceResponse(response: Response): Promise<void> {
    const payload = (await response.json()) as {
      workspace?: Workspace;
      error?: { message?: string };
    };
    if (!response.ok)
      throw new Error(payload.error?.message ?? `Request failed (${response.status})`);
    if (payload.workspace) {
      setWorkspace(payload.workspace);
      setConnectionStatus("connected");
      setSelected((current) =>
        current
          ? (payload.workspace?.documents.find((item) => item.id === current.id) ?? null)
          : null,
      );
    }
  }
  async function refresh(): Promise<void> {
    try {
      const response = await fetch("/api/runtime/workspace/refresh", { method: "POST" });
      await acceptWorkspaceResponse(response);
      setConnectionStatus("connected");
      setNotice("Workspace index refreshed");
    } catch (error) {
      setConnectionStatus("offline");
      setNotice(error instanceof Error ? error.message : "Could not refresh workspace index");
    }
  }
  async function validate(): Promise<void> {
    try {
      const response = await fetch("/api/runtime/workspace/validate", { method: "POST" });
      const result = (await response.json()) as {
        diagnostics?: Array<{ path: string; message: string }>;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(result.error?.message ?? "Validation failed");
      setNotice(`Validation complete · ${result.diagnostics?.length ?? 0} issue(s)`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Validation failed");
    }
  }
  function selectSection(label: string) {
    setSection(label);
    if (label === "Tasks") setTaskFilter(null);
    setSelected(null);
    setMobileNav(false);
    setPaletteOpen(false);
  }
  function selectSavedView(filter: string) {
    setTaskFilter(filter);
    setSection("Tasks");
    setSelected(null);
    setMobileNav(false);
  }
  function openCreate(date = "") {
    setTitle("");
    setDescription("");
    setDueDate(date);
    setGroup(workspace?.groups.find((item) => !item.archived)?.id ?? "");
    setDialog(true);
  }

  function resizeSidebar(event: PointerEvent<HTMLDivElement>): void {
    if (event.type === "pointerdown") {
      if (event.button !== 0) return;
      draggingSidebar.current = {
        pointerId: event.pointerId,
        left: event.currentTarget.parentElement?.getBoundingClientRect().left ?? 0,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (event.type === "pointermove") {
      if (draggingSidebar.current.pointerId !== event.pointerId) return;
      const next = sidebarResize(event.clientX - draggingSidebar.current.left);
      setCollapsed(next.collapsed);
      if (!next.collapsed) setSidebarWidth(next.width);
      return;
    }
    if (draggingSidebar.current.pointerId !== event.pointerId) return;
    draggingSidebar.current.pointerId = -1;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resizeSidebarByKeyboard(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    if (event.key === "ArrowLeft") {
      const next = sidebarResize((collapsed ? 76 : sidebarWidth) - 24);
      setCollapsed(next.collapsed);
      if (!next.collapsed) setSidebarWidth(next.width);
      return;
    }
    if (collapsed) {
      setSidebarWidth(Math.max(208, sidebarWidth));
      setCollapsed(false);
      return;
    }
    setSidebarWidth(clampSidebarWidth(sidebarWidth + 24));
  }

  async function createTask(): Promise<void> {
    if (!title.trim()) {
      setNotice("Enter a task title.");
      return;
    }
    setCreating(true);
    try {
      let activeGroup = group;
      if (!activeGroup && newGroup.trim()) {
        const groupResponse = await fetch("/api/runtime/workspace/task-groups", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: newGroup.trim() }),
        });
        const groupPayload = (await groupResponse.json()) as {
          group?: Group;
          error?: { message?: string };
        };
        if (!groupResponse.ok || !groupPayload.group)
          throw new Error(groupPayload.error?.message ?? "Could not create task group");
        activeGroup = groupPayload.group.id;
      }
      if (!activeGroup) throw new Error("Choose or create a task group first.");
      const response = await fetch("/api/runtime/workspace/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description,
          group: activeGroup,
          ...(dueDate ? { dueAt: dueDate } : {}),
        }),
      });
      const payload = (await response.json()) as {
        task?: { metadata: { id: string } };
        workspace?: Workspace;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not create task");
      if (payload.workspace) setWorkspace(payload.workspace);
      setDialog(false);
      setNewGroup("");
      setNotice("Task created");
      const createdTask = payload.workspace?.documents.find(
        (item) => item.id === payload.task?.metadata.id,
      );
      if (createdTask) setSelected(createdTask);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create task");
    } finally {
      setCreating(false);
    }
  }

  async function handleDrop(event: DragEndEvent): Promise<void> {
    const operation = event.operation;
    const source = operation.source;
    const target = operation.target;
    const taskId = source?.data.taskId;
    const targetDate = target?.data.date;
    const targetStatus = target?.data.status;
    if (typeof taskId !== "string") return;
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const update = taskDropUpdate(
      task,
      {
        ...(typeof targetDate === "string" ? { date: targetDate } : {}),
        ...(typeof targetStatus === "string" ? { status: targetStatus } : {}),
      },
      event.canceled,
    );
    if (!update) return;
    try {
      const response = await fetch(`/api/runtime/workspace/task/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      });
      await acceptWorkspaceResponse(response);
      setNotice(
        update.dueAt
          ? `Scheduled for ${formatDate(update.dueAt)}`
          : `Moved to ${statusNames[update.status ?? ""] ?? update.status}`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Task update failed; refresh and try again",
      );
    }
  }

  const matchingSearch = useMemo(() => searchResults.slice(0, 8), [searchResults]);
  const navCompact = collapsed && !mobileNav;
  const dueSoonCount = tasks.filter((task) => {
    if (!task.due_at || task.status === "completed") return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const through = new Date(today);
    through.setDate(through.getDate() + 7);
    return task.due_at >= dateKey(today) && task.due_at <= dateKey(through);
  }).length;
  const sidebarHeader = (
    <div
      className={`flex h-12 shrink-0 items-center border-b border-border/50 ${navCompact ? "justify-center px-1" : "gap-2 px-1"}`}
    >
      {navCompact ? (
        <span aria-label="Task" className="grid size-8 shrink-0 place-items-center" role="img">
          <img src="/task-symbol.svg" alt="" className="size-8" />
        </span>
      ) : (
        <span aria-label="Task" className="flex h-8 w-28 shrink-0 items-center" role="img">
          <img src="/task-mark.svg" alt="" className="h-8 w-28 dark:hidden" />
          <img src="/task-mark-dark.svg" alt="" className="hidden h-8 w-28 dark:block" />
        </span>
      )}
      {!navCompact && (
        <>
          <span className="flex-1" />
          {mobileNav ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Close navigation"
              onClick={() => setMobileNav(false)}
            >
              <X className="size-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              onClick={() => setCollapsed(true)}
            >
              <PanelLeftClose className="size-4" />
            </Button>
          )}
        </>
      )}
    </div>
  );
  const projectSwitcher = (
    <div
      data-slot="project-switcher"
      className="relative shrink-0 border-t border-border/50 pt-3"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setProjectSwitcherOpen(false);
      }}
    >
      {projectSwitcherOpen && (
        <div
          role="menu"
          aria-label="Project switcher"
          className={`absolute bottom-full z-50 mb-2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground ${navCompact ? "left-0 w-64" : "inset-x-0"}`}
        >
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
            <span className="text-xs font-medium">Current project</span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            title={workspace?.projectRoot ?? "No project selected"}
            onClick={() => setProjectSwitcherOpen(false)}
            className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-accent/60"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
              <FolderKanban className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {workspace?.projectName ?? "No project selected"}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                {workspace?.projectRoot ?? "Start Task from a project directory"}
              </span>
            </span>
            <Check className="size-4 shrink-0 text-primary" />
          </button>
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        aria-haspopup="menu"
        aria-expanded={projectSwitcherOpen}
        aria-label={navCompact ? `Current project: ${workspace?.projectName ?? "none"}` : undefined}
        title={navCompact ? (workspace?.projectName ?? "No project selected") : undefined}
        onClick={() => setProjectSwitcherOpen((open) => !open)}
        className={`h-auto w-full justify-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-accent/70 ${navCompact ? "justify-center px-1" : ""}`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border/50 bg-background text-muted-foreground">
          <FolderKanban className="size-4" />
        </span>
        {!navCompact && (
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] leading-4 text-muted-foreground">Project</span>
            <span className="block truncate text-xs font-medium">
              {workspace?.projectName ?? "Select a project"}
            </span>
          </span>
        )}
        {!navCompact && <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />}
      </Button>
    </div>
  );
  const mainNav = (
    <>
      {!navCompact && (
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
          Workspace
        </p>
      )}
      <nav aria-label="Workspace navigation" className="space-y-1">
        {navigation.map(({ label, icon: Icon }) => (
          <button
            type="button"
            key={label}
            title={navCompact ? label : undefined}
            onClick={() => selectSection(label)}
            aria-current={section === label ? "page" : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${navCompact ? "justify-center px-2" : ""} ${section === label ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"}`}
          >
            <Icon className="size-4 shrink-0" />
            {!navCompact && (
              <>
                <span className="flex-1">{label}</span>
                {label === "Tasks" && <span className="text-xs opacity-70">{tasks.length}</span>}
              </>
            )}
          </button>
        ))}
      </nav>
      <section className={`mt-7 ${navCompact ? "text-center" : ""}`}>
        {!navCompact && (
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
            Saved views
          </p>
        )}
        <button
          type="button"
          title={navCompact ? "Saved views" : undefined}
          aria-expanded={savedViewsOpen}
          onClick={() => setSavedViewsOpen((open) => !open)}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground ${navCompact ? "justify-center px-2" : ""}`}
        >
          <Bookmark className="size-4 shrink-0" />
          {!navCompact && (
            <>
              <span className="flex-1">Quick filters</span>
              <ChevronDown
                className={`size-3.5 transition-transform ${savedViewsOpen ? "rotate-180" : ""}`}
              />
            </>
          )}
        </button>
        {savedViewsOpen && (
          <nav aria-label="Task quick filters" className="mt-1 space-y-1">
            {[
              { id: "in-progress", label: "In progress" },
              { id: "blocked", label: "Blocked" },
              { id: "due-soon", label: "Due soon" },
              { id: "completed", label: "Completed" },
            ].map(({ id, label }) => {
              const Icon = id === "due-soon" ? Clock3 : CircleDot;
              const count =
                id === "due-soon"
                  ? dueSoonCount
                  : id === "completed"
                    ? completedTasks.length
                    : tasks.filter((task) => task.status === id).length;
              return (
                <button
                  type="button"
                  key={id}
                  title={navCompact ? label : undefined}
                  aria-current={taskFilter === id ? "page" : undefined}
                  onClick={() => selectSavedView(id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs transition-colors ${navCompact ? "justify-center px-2" : "pl-4"} ${taskFilter === id ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"}`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {!navCompact && (
                    <>
                      <span className="flex-1">{label}</span>
                      <span className="text-[10px] tabular-nums">{count}</span>
                    </>
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </section>
      <section className="mt-7">
        {!navCompact && (
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
            Workspace tools
          </p>
        )}
        <nav aria-label="Workspace tools" className="space-y-1">
          {operations.map(({ label, icon: Icon }) => (
            <button
              type="button"
              key={label}
              title={navCompact ? label : undefined}
              onClick={() => selectSection(label)}
              aria-current={section === label ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${navCompact ? "justify-center px-2" : ""} ${section === label ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"}`}
            >
              <Icon className="size-4 shrink-0" />
              {!navCompact && label}
            </button>
          ))}
        </nav>
      </section>
    </>
  );

  return (
    <DragDropProvider onDragEnd={(event) => void handleDrop(event)}>
      <div
        data-slot="task-app-shell"
        onPointerDownCapture={(event) => {
          const target = event.target;
          if (
            projectSwitcherOpen &&
            target instanceof Element &&
            !target.closest('[data-slot="project-switcher"]')
          ) {
            setProjectSwitcherOpen(false);
          }
        }}
        className="grid h-svh w-full min-w-0 grid-cols-1 overflow-hidden bg-background text-foreground md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]"
        style={{ "--sidebar-width": collapsed ? "76px" : `${sidebarWidth}px` } as CSSProperties}
      >
        <Sidebar
          data-slot="task-sidebar"
          className={`relative z-40 hidden h-svh min-h-0 min-w-0 flex-col overflow-visible border-r border-border/50 bg-card/35 p-3 md:flex ${collapsed ? "" : "px-4"}`}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {sidebarHeader}
            <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-4">
              {mainNav}
            </div>
            {projectSwitcher}
          </div>
          <hr
            aria-label="Resize workspace sidebar"
            aria-orientation="vertical"
            aria-valuemin={208}
            aria-valuemax={360}
            aria-valuenow={collapsed ? 76 : sidebarWidth}
            aria-valuetext={collapsed ? "Collapsed" : `${sidebarWidth} pixels`}
            tabIndex={0}
            onPointerDown={resizeSidebar}
            onPointerMove={resizeSidebar}
            onPointerUp={resizeSidebar}
            onPointerCancel={resizeSidebar}
            onKeyDown={resizeSidebarByKeyboard}
            className="group absolute inset-y-0 -right-1 z-40 hidden h-full w-2 cursor-col-resize touch-none border-0 bg-transparent outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded-full after:bg-border after:content-[''] after:transition-colors hover:after:bg-ring/60 focus-visible:after:bg-ring md:block"
          />
        </Sidebar>
        <div className="relative flex min-h-0 min-w-0 flex-col overflow-hidden">
          {mobileNav && (
            <div className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px] md:hidden">
              <button
                type="button"
                className="absolute inset-0 size-full cursor-default"
                aria-label="Close workspace navigation"
                onClick={() => setMobileNav(false)}
              />
              <aside className="relative flex h-full w-[min(84vw,300px)] flex-col overflow-hidden border-r border-border/50 bg-background p-4">
                {sidebarHeader}
                <div className="min-h-0 flex-1 overflow-y-auto py-4">{mainNav}</div>
                {projectSwitcher}
              </aside>
            </div>
          )}
          <header
            data-slot="main-toolbar"
            className="relative z-30 flex h-12 shrink-0 items-center gap-3 px-3 sm:px-5 xl:px-7"
          >
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open workspace navigation"
              onClick={() => setMobileNav(true)}
            >
              <ListTodo className="size-4" />
            </Button>
            <h1 className="min-w-0 shrink-0 truncate text-sm font-semibold tracking-tight sm:text-base">
              {taskFilter
                ? taskFilter === "due-soon"
                  ? "Due soon"
                  : (statusNames[taskFilter] ?? section)
                : section}
            </h1>
            <div className="relative mx-auto hidden w-full max-w-xl lg:block">
              <InputGroup className="h-10 bg-card">
                <Search className="size-4 shrink-0" />
                <InputGroupInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && matchingSearch[0])
                      void selectSearchResult(matchingSearch[0]);
                  }}
                  placeholder="Search tasks and documents…"
                  aria-label="Search workspace"
                />
                <kbd className="rounded-lg border bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  ⌘ K
                </kbd>
                {query && (
                  <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                    <X className="size-4" />
                  </button>
                )}
              </InputGroup>
              {query.trim() && (
                <div className="absolute top-12 z-40 max-h-96 w-full overflow-y-auto rounded-2xl border bg-popover p-1.5">
                  {searching ? (
                    <p className="p-3 text-sm text-muted-foreground">Searching workspace…</p>
                  ) : matchingSearch.length ? (
                    matchingSearch.map((result) => (
                      <button
                        type="button"
                        key={result.path}
                        onClick={() => void selectSearchResult(result)}
                        className="flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-accent"
                      >
                        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{result.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {result.id} · {result.path}
                          </span>
                          <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                            {result.snippet}
                          </span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="p-3 text-sm text-muted-foreground">
                      No matching records in this workspace.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Search workspace"
                onClick={() => setPaletteOpen(true)}
              >
                <Search className="size-4" />
              </Button>
              <Button
                onClick={() => openCreate()}
                size="icon"
                className="lg:hidden"
                aria-label="Create task"
              >
                <Plus className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={`Theme: ${theme}`}
                title={`Theme: ${theme}`}
                onClick={() => {
                  const next: ThemeChoice =
                    theme === "system" ? "light" : theme === "light" ? "dark" : "system";
                  setTheme(next);
                  window.localStorage.setItem("task-theme", next);
                  applyTheme(next);
                }}
              >
                <ThemeIcon className="size-4" />
              </Button>
              <Button onClick={() => openCreate()} size="sm" className="hidden lg:inline-flex">
                <Plus className="size-4" />
                New task
              </Button>
            </div>
          </header>
          <main
            data-slot="main-content"
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
          >
            {connectionStatus === "offline" && (
              <div
                role="alert"
                className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm sm:mx-7 xl:mx-10"
              >
                <p className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="size-4 shrink-0" />
                  Local runtime connection failed. Workspace changes may be unavailable.
                </p>
                <Button size="sm" variant="outline" onClick={() => void refresh()}>
                  Retry connection
                </Button>
              </div>
            )}
            <section className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8 xl:px-10">
              <div
                className={`grid gap-5 ${selected ? "xl:grid-cols-[minmax(0,1fr)_370px]" : "grid-cols-1"}`}
              >
                <div className="min-w-0">
                  {section === "Overview" && (
                    <>
                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Workspace overview</p>
                          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                            {workspace?.projectName ?? "Your workspace"}
                          </h1>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {workspace?.workspaceDirectory ??
                              "Local project activity and task progress"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="outline" className="h-10 rounded-xl px-3">
                            <Clock3 className="size-4" /> This week
                          </Badge>
                        </div>
                      </div>
                      {!workspace && connectionStatus !== "offline" && (
                        <Card className="mt-5 border-dashed">
                          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                            <div>
                              <p className="font-medium">
                                {workspaceError
                                  ? "Could not load this project"
                                  : "Loading project workspace…"}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {workspaceError ?? "Connecting to the selected local project."}
                              </p>
                            </div>
                            <Button variant="outline" onClick={() => void refresh()}>
                              Refresh workspace
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric
                          label="Completed this week"
                          value={completedThisWeek}
                          icon={Check}
                        />
                        <Metric
                          label="Active tasks"
                          value={workspace?.overview.inProgress ?? "—"}
                          icon={Timer}
                        />
                        <Metric label="Upcoming" value={upcomingCount} icon={Clock3} />
                        <Metric
                          label="Blocked"
                          value={workspace?.overview.blocked ?? "—"}
                          icon={AlertTriangle}
                        />
                      </div>
                      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)]">
                        <div className="space-y-5">
                          <Card>
                            <CardHeader className="flex-row items-center justify-between">
                              <div>
                                <CardTitle>Tasks completed</CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Daily completions · this week
                                </p>
                              </div>
                              <Badge variant="secondary">{completedThisWeek} total</Badge>
                            </CardHeader>
                            <CardContent>
                              <div
                                role="img"
                                aria-label={`Tasks completed each day this week: ${completionByDay.map((day) => `${day.date} ${day.count}`).join(", ")}`}
                                className="relative grid h-52 grid-cols-7 items-end gap-3 border-b px-2 pt-4 sm:gap-5"
                              >
                                {completedThisWeek === 0 && (
                                  <span className="pointer-events-none absolute inset-x-0 top-12 text-center text-xs text-muted-foreground">
                                    No completions recorded this week yet.
                                  </span>
                                )}
                                {completionByDay.map((day) => {
                                  const date = new Date(`${day.date}T12:00:00`);
                                  const height =
                                    day.count === 0
                                      ? 3
                                      : Math.max(12, (day.count / maxCompletion) * 160);
                                  return (
                                    <div
                                      key={day.date}
                                      className="flex h-full min-w-0 flex-col items-center"
                                    >
                                      <span className="mb-2 text-xs font-medium tabular-nums">
                                        {day.count}
                                      </span>
                                      <div className="mt-auto flex h-40 w-full items-end">
                                        <div
                                          className={`w-full rounded-t-lg ${day.count > 0 ? "bg-primary/75" : "bg-muted"}`}
                                          style={{ height: `${height}px` }}
                                        />
                                      </div>
                                      <span className="py-2 text-[10px] text-muted-foreground sm:text-xs">
                                        {new Intl.DateTimeFormat(undefined, {
                                          weekday: "short",
                                        }).format(date)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="mt-3 text-xs text-muted-foreground">
                                History is recorded from status changes made after tracking was
                                enabled.
                              </p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="flex-row items-center justify-between">
                              <CardTitle>Recent workspace changes</CardTitle>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => selectSection("Activity")}
                              >
                                View activity
                              </Button>
                            </CardHeader>
                            <CardContent className="divide-y">
                              {workspace?.overview.recent.slice(0, 5).map((item) => (
                                <button
                                  type="button"
                                  key={item.path}
                                  onClick={() => setSelected(item)}
                                  className="flex w-full items-center gap-3 py-3 text-left"
                                >
                                  <FileText className="size-4 text-muted-foreground" />
                                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                    {item.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate(item.updated_at)}
                                  </span>
                                </button>
                              ))}
                              {workspace?.overview.recent.length === 0 && (
                                <p className="py-4 text-sm text-muted-foreground">
                                  No workspace changes yet.
                                </p>
                              )}
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="flex-row items-center justify-between">
                              <div>
                                <CardTitle>Task groups</CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Your workspace organization
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => selectSection("Groups")}
                              >
                                View all
                              </Button>
                            </CardHeader>
                            <CardContent className="divide-y">
                              {workspace?.groups
                                .filter((item) => !item.archived)
                                .slice(0, 4)
                                .map((item) => (
                                  <button
                                    type="button"
                                    key={item.id}
                                    onClick={() => selectSection("Groups")}
                                    className="flex w-full items-center gap-3 py-3 text-left"
                                  >
                                    <FolderKanban className="size-4 text-muted-foreground" />
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                      {item.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {item.completed}/{item.total} complete
                                    </span>
                                  </button>
                                ))}
                              {workspace?.groups.filter((item) => !item.archived).length === 0 && (
                                <p className="py-4 text-sm text-muted-foreground">
                                  Create a task to start your first group.
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                        <div className="space-y-5">
                          <Card>
                            <CardHeader className="flex-row items-center justify-between">
                              <div>
                                <CardTitle>Completed and archived</CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  The latest finished workspace tasks
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => selectSavedView("completed")}
                              >
                                View all
                              </Button>
                            </CardHeader>
                            <CardContent className="divide-y">
                              {completedTasks.slice(0, 5).map((task) => {
                                const completionEvent = [...(task.extra?.status_history ?? [])]
                                  .reverse()
                                  .find((change) => change.to === "completed");
                                const archived = isArchivedTask(task);
                                return (
                                  <button
                                    type="button"
                                    key={task.path}
                                    onClick={() => setSelected(task)}
                                    className="flex w-full items-center gap-3 py-3 text-left"
                                  >
                                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                                      <Check className="size-3.5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-medium">
                                        {task.name}
                                      </span>
                                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                        {task.id} · {archived ? "Archived" : "Completed"}
                                      </span>
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                      {formatDate(
                                        task.archived_at ?? completionEvent?.at ?? task.updated_at,
                                      )}
                                    </span>
                                  </button>
                                );
                              })}
                              {completedTasks.length === 0 && (
                                <p className="py-4 text-sm text-muted-foreground">
                                  Completed tasks will appear here.
                                </p>
                              )}
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader>
                              <CardTitle>Upcoming tasks</CardTitle>
                            </CardHeader>
                            <CardContent className="divide-y">
                              {tasks
                                .filter((task) => task.due_at && task.status !== "completed")
                                .sort((left, right) =>
                                  (left.due_at ?? "").localeCompare(right.due_at ?? ""),
                                )
                                .slice(0, 5)
                                .map((task) => (
                                  <button
                                    type="button"
                                    key={task.id}
                                    onClick={() => setSelected(task)}
                                    className="flex w-full items-start gap-3 py-3 text-left"
                                  >
                                    <span className="mt-1.5 size-2 rounded-full bg-primary/70" />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-medium">
                                        {task.name}
                                      </span>
                                      <span className="mt-1 block text-xs text-muted-foreground">
                                        {task.id}
                                      </span>
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                      {formatDate(task.due_at)}
                                    </span>
                                  </button>
                                ))}
                              {tasks.filter((task) => task.due_at && task.status !== "completed")
                                .length === 0 && (
                                <p className="py-4 text-sm text-muted-foreground">
                                  No scheduled tasks coming up.
                                </p>
                              )}
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader>
                              <CardTitle>Workspace health</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Runtime</span>
                                <Badge
                                  variant={connectionStatus === "connected" ? "success" : "warning"}
                                >
                                  {connectionStatus}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Validation issues</span>
                                <span className="font-medium">
                                  {workspace?.overview.diagnostics ?? "—"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Documents</span>
                                <span className="font-medium">
                                  {workspace?.overview.documents ?? "—"}
                                </span>
                              </div>
                              <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => void validate()}
                              >
                                Run validation
                              </Button>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader>
                              <CardTitle>Quick actions</CardTitle>
                              <p className="text-sm text-muted-foreground">Workspace shortcuts.</p>
                            </CardHeader>
                            <CardContent className="grid gap-2">
                              <Button
                                variant="ghost"
                                className="justify-start"
                                onClick={() => selectSection("Documents")}
                              >
                                <BookOpen className="size-4" />
                                Browse documents
                              </Button>
                              <Button
                                variant="ghost"
                                className="justify-start"
                                onClick={() => void refresh()}
                              >
                                <Activity className="size-4" />
                                Refresh workspace index
                              </Button>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </>
                  )}
                  {section === "Tasks" && (
                    <>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Plan, prioritize, and keep work moving.
                          </p>
                          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{section}</h1>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant={taskView === "List" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setTaskView("List")}
                          >
                            List
                          </Button>
                          <Button
                            variant={taskView === "Board" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setTaskView("Board")}
                          >
                            Board
                          </Button>
                          <Button
                            variant={taskView === "Calendar" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setTaskView("Calendar")}
                          >
                            Calendar
                          </Button>
                        </div>
                      </div>
                      {taskView === "Board" ? (
                        <div className="mt-5 grid gap-3 xl:grid-cols-4">
                          {statuses.map((status) => (
                            <Card key={status} className="min-w-0 bg-muted/25">
                              <CardHeader className="pb-2">
                                <CardTitle className="flex items-center justify-between text-sm">
                                  {statusNames[status]}
                                  <Badge variant="secondary">
                                    {visibleTasks.filter((task) => task.status === status).length}
                                  </Badge>
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <StatusDropZone status={status}>
                                  {visibleTasks
                                    .filter((task) => task.status === status)
                                    .map((task) => (
                                      <div
                                        key={task.id}
                                        className="border-b border-border/70 px-3 py-3 last:border-b-0 hover:bg-accent/30"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => setSelected(task)}
                                          className="w-full text-left"
                                        >
                                          <p className="text-sm font-medium">{task.name}</p>
                                          <p className="mt-2 text-[11px] text-muted-foreground">
                                            {task.id}
                                          </p>
                                        </button>
                                        <div className="mt-2">
                                          <BoardTask
                                            task={task}
                                            onSelect={() => setSelected(task)}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                </StatusDropZone>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : taskView === "Calendar" ? (
                        <CalendarView
                          tasks={visibleTasks}
                          onCreate={openCreate}
                          onSelect={(task) =>
                            setSelected(visibleTasks.find((item) => item.id === task.id) ?? null)
                          }
                        />
                      ) : (
                        <div className="mt-5 overflow-hidden border-y border-border/70">
                          {visibleTasks.map((item) => (
                            <button
                              type="button"
                              key={item.path}
                              onClick={() => setSelected(item)}
                              className="flex w-full items-center gap-3 border-b p-3.5 text-left last:border-0 hover:bg-accent/50"
                            >
                              <span className="grid size-5 place-items-center rounded-full border">
                                <span
                                  className={`size-2 rounded-full ${item.status === "completed" ? "bg-emerald-500" : ""}`}
                                />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">
                                  {item.name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {item.id} · {item.path}
                                </span>
                              </span>
                              <Badge variant={statusVariant(item.status)}>
                                {statusNames[item.status ?? ""] ?? item.status ?? "Planned"}
                              </Badge>
                              <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">
                                {formatDate(item.due_at)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {section === "Documents" && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Browse managed workspace records and Markdown.
                      </p>
                      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Documents</h1>
                      <div className="mt-5 overflow-hidden border-y border-border/70">
                        {docs.map((item) => (
                          <button
                            type="button"
                            key={item.path}
                            onClick={() => setSelected(item)}
                            className="flex w-full items-center gap-3 border-b p-3.5 text-left last:border-0 hover:bg-accent/50"
                          >
                            <FileText className="size-4 text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">{item.name}</span>
                              <span className="text-xs text-muted-foreground">{item.path}</span>
                            </span>
                            <Badge variant="outline">{item.type}</Badge>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {section === "Groups" && (
                    <>
                      <h1 className="text-3xl font-semibold">Groups</h1>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Task groups organize work inside this active local project.
                      </p>
                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {workspace?.groups
                          .filter((item) => !item.archived)
                          .map((item) => (
                            <Card key={item.id} className="">
                              <CardContent className="flex items-center gap-3 p-4">
                                <FolderKanban className="size-5 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.completed}/{item.total} complete · {item.path}
                                  </p>
                                </div>
                                <ChevronRight className="size-4 text-muted-foreground" />
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </>
                  )}
                  {section === "Agent prompts" && (
                    <PromptBuilder records={records} workspace={workspace} setNotice={setNotice} />
                  )}
                  {section === "Activity" && (
                    <>
                      <h1 className="text-3xl font-semibold">Activity</h1>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Recent filesystem reconciliation view (source: workspace modified
                        timestamps).
                      </p>
                      <div className="mt-5 space-y-2">
                        {[...records]
                          .sort((a, b) => b.modifiedAt - a.modifiedAt)
                          .slice(0, 30)
                          .map((item) => (
                            <button
                              type="button"
                              key={item.path}
                              onClick={() => setSelected(item)}
                              className="flex w-full items-center gap-3 border-b border-border/70 px-3 py-3 text-left last:border-b-0 hover:bg-accent/30"
                            >
                              <Activity className="size-4 text-muted-foreground" />
                              <span className="flex-1 text-sm">{item.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(item.modifiedAt).toLocaleString()}
                              </span>
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                  {section === "Workspace health" && (
                    <>
                      <h1 className="text-3xl font-semibold">Workspace health</h1>
                      <Card className="mt-5">
                        <CardContent className="space-y-3 p-5">
                          <p>
                            Runtime: <strong>{connectionStatus}</strong>
                          </p>
                          <p>
                            Project:{" "}
                            <code className="text-xs">
                              {workspace?.projectRoot ?? "Not selected"}
                            </code>
                          </p>
                          <p>
                            Managed directory:{" "}
                            <code className="text-xs">{workspace?.workspaceDirectory ?? "—"}</code>
                          </p>
                          <p>Index source: {workspace?.source ?? "—"}</p>
                          <p>
                            Last snapshot:{" "}
                            {workspace ? new Date(workspace.scannedAt).toLocaleString() : "—"}
                          </p>
                          <Separator />
                          {workspace?.diagnostics.map((item) => (
                            <p
                              key={`${item.path}:${item.message}`}
                              className="text-sm text-amber-700"
                            >
                              {item.path}: {item.message}
                            </p>
                          ))}
                          <Button onClick={() => void refresh()}>Refresh index</Button>
                          <Button variant="outline" onClick={() => void validate()}>
                            Validate
                          </Button>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
                {selected && (
                  <aside className="border-l border-border/60 bg-transparent p-5 xl:sticky xl:top-4 xl:max-h-[calc(100svh-6rem)] xl:overflow-y-auto">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{selected.id}</p>
                        <h2 className="mt-1 text-xl font-semibold">{selected.name}</h2>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Close details"
                        onClick={() => setSelected(null)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Badge variant={statusVariant(selected.status)}>
                        {statusNames[selected.status ?? ""] ?? "Document"}
                      </Badge>
                      {selected.priority && (
                        <Badge variant="outline">{selected.priority} priority</Badge>
                      )}
                    </div>
                    <Separator className="my-5" />
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Start</p>
                        <p className="mt-1 font-medium">{formatDate(selected.start_at)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Due</p>
                        <p className="mt-1 font-medium">{formatDate(selected.due_at)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="mt-1 font-medium">{formatDate(selected.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Updated</p>
                        <p className="mt-1 font-medium">{formatDate(selected.updated_at)}</p>
                      </div>
                    </div>
                    <p className="mt-4 break-all text-xs text-muted-foreground">{selected.path}</p>
                    <Separator className="my-5" />
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">
                        {editingDocument ? "Markdown source" : "Markdown preview"}
                      </h3>
                      {detail && !editingDocument && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDocumentDraft(detail.body);
                            setEditingDocument(true);
                          }}
                        >
                          Edit Markdown
                        </Button>
                      )}
                    </div>
                    {detail ? (
                      editingDocument ? (
                        <>
                          <textarea
                            aria-label="Markdown source"
                            value={documentDraft}
                            onChange={(event) => setDocumentDraft(event.target.value)}
                            spellCheck={false}
                            className="mt-3 min-h-72 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <div className="mt-3 flex justify-end gap-2">
                            <Button
                              variant="outline"
                              disabled={savingDocument}
                              onClick={() => {
                                setDocumentDraft(detail.body);
                                setEditingDocument(false);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              disabled={savingDocument || documentDraft === detail.body}
                              onClick={() => void saveDocument()}
                            >
                              {savingDocument ? "Saving…" : "Save changes"}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <pre className="mt-3 whitespace-pre-wrap break-words border-y border-border/60 py-3 font-mono text-[11px] leading-5">
                          {detail.body}
                        </pre>
                      )
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">Loading content…</p>
                    )}
                  </aside>
                )}
              </div>
            </section>
          </main>
        </div>

        {dialog && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <button
              type="button"
              className="absolute inset-0 size-full cursor-default bg-black/35"
              aria-label="Close task creation"
              onClick={() => setDialog(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-title"
              className="relative z-10 w-full max-w-lg rounded-2xl border bg-card p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-primary">New task</p>
                  <h2 id="create-title" className="mt-1 text-xl font-semibold">
                    Add to your workspace
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDialog(false)}
                  aria-label="Close"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="mt-5 space-y-4">
                <label htmlFor="new-task-title" className="block text-sm font-medium">
                  Task name
                  <Input
                    id="new-task-title"
                    autoFocus
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void createTask();
                    }}
                    placeholder="What needs to get done?"
                    className="mt-1.5"
                  />
                </label>
                <label htmlFor="new-task-description" className="block text-sm font-medium">
                  Description
                  <textarea
                    id="new-task-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-lg border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Add a few details…"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label htmlFor="new-task-group" className="text-sm font-medium">
                    Task group
                    <select
                      id="new-task-group"
                      value={group}
                      onChange={(event) => setGroup(event.target.value)}
                      className="mt-1.5 h-9 w-full rounded-lg border bg-background px-3 text-sm"
                    >
                      {" "}
                      <option value="">Select group…</option>
                      {workspace?.groups
                        .filter((item) => !item.archived)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label htmlFor="new-task-due-date" className="text-sm font-medium">
                    Due date
                    <input
                      id="new-task-due-date"
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="mt-1.5 h-9 w-full rounded-lg border bg-background px-3 text-sm"
                    />
                  </label>
                </div>
                {!workspace?.groups.some((item) => !item.archived) && (
                  <label htmlFor="new-task-group-name" className="block text-sm font-medium">
                    Create your first task group
                    <Input
                      id="new-task-group-name"
                      value={newGroup}
                      onChange={(event) => setNewGroup(event.target.value)}
                      placeholder="For example, Website refresh"
                      className="mt-1.5"
                    />
                  </label>
                )}
                {workspace?.groups.length && !group ? (
                  <label htmlFor="new-task-group-name" className="block text-sm font-medium">
                    Or create a new group
                    <Input
                      id="new-task-group-name"
                      value={newGroup}
                      onChange={(event) => setNewGroup(event.target.value)}
                      placeholder="Group name"
                      className="mt-1.5"
                    />
                  </label>
                ) : null}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialog(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={creating || !title.trim() || (!group && !newGroup.trim())}
                  onClick={() => void createTask()}
                >
                  {creating ? "Creating…" : "Create task"}
                </Button>
              </div>
            </div>
          </div>
        )}
        {paletteOpen && (
          <div className="fixed inset-0 z-50 grid place-items-start px-4 pt-[12vh]">
            <button
              type="button"
              className="absolute inset-0 size-full cursor-default bg-black/35"
              aria-label="Close command palette"
              onClick={() => setPaletteOpen(false)}
            />
            <div className="relative z-10 mx-auto w-full max-w-lg overflow-hidden rounded-2xl border bg-popover p-2">
              <InputGroup className="border-0 focus-within:ring-0">
                <Search className="size-4" />
                <InputGroupInput
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search or jump to…"
                />
              </InputGroup>
              <div className="mt-2 max-h-[55svh] overflow-y-auto border-t pt-2">
                {matchingSearch.map((result) => (
                  <button
                    type="button"
                    key={result.path}
                    onClick={() => void selectSearchResult(result)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent"
                  >
                    <Search className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{result.name}</span>
                    <span className="text-xs text-muted-foreground">{result.id}</span>
                  </button>
                ))}
                {[...navigation, ...operations].map(({ label, icon: Icon }) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => selectSection(label)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    {label}
                    <Command className="ml-auto size-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="fixed bottom-5 right-5 z-[60] flex max-w-lg items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm"
          >
            <Check className="size-4 shrink-0 text-emerald-600" />
            <span>{notice}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setNotice("")}
              className="ml-2"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
      </div>
    </DragDropProvider>
  );

  async function selectSearchResult(result: SearchResult): Promise<void> {
    try {
      const response = await fetch("/api/runtime/workspace", { cache: "no-store" });
      const payload = (await response.json()) as {
        workspace?: Workspace;
        error?: { message?: string };
      };
      if (!response.ok || !payload.workspace)
        throw new Error(payload.error?.message ?? "Could not refresh the workspace snapshot");
      setWorkspace(payload.workspace);
      const current = payload.workspace.documents.find(
        (item) => item.path === result.path || item.id === result.id,
      );
      if (!current) throw new Error("This result changed or was removed. Search again.");
      setSelected(current);
      setQuery("");
      setPaletteOpen(false);
      setSection(current.type === "task" ? "Tasks" : "Documents");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not open this search result");
    }
  }
}

function PromptBuilder({
  records,
  workspace,
  setNotice,
}: {
  records: RecordItem[];
  workspace: Workspace | null;
  setNotice(message: string): void;
}) {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  function generate() {
    const selected = records.filter((item) => selectedPaths.includes(item.path));
    const paths = selected
      .map((item) => `- ${item.id} — ${item.name}\n Path: ${item.path}`)
      .join("\n");
    setPrompt(
      `You are working in the Task project at ${workspace?.projectRoot ?? "<project-root>"}.\n\nUse Task CLI commands (task or tk) to inspect or update managed files. Read the referenced files first and validate changes with task validate.\n\nSelected context:\n${paths || "- No files selected"}\n\nPlease review the repository and complete the requested work. Summarize changed files and verification performed.`,
    );
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Prepare reviewed workspace context for an agent.
      </p>
      <h1 className="mt-1 text-3xl font-semibold">Agent prompt builder</h1>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Select records</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[60svh] space-y-2 overflow-auto">
            {records.map((item) => (
              <label
                key={item.path}
                className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selectedPaths.includes(item.path)}
                  onChange={(event) =>
                    setSelectedPaths((current) =>
                      event.target.checked
                        ? [...current, item.path]
                        : current.filter((path) => path !== item.path),
                    )
                  }
                />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.id}</span>
              </label>
            ))}
            <Button onClick={generate}>Generate prompt</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Review prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-72 w-full rounded-xl border bg-background p-3 font-mono text-xs"
              placeholder="Generate a prompt to review it here."
            />
            <div className="mt-3 flex gap-2">
              <Button
                disabled={!prompt}
                onClick={() => {
                  void navigator.clipboard.writeText(prompt);
                  setNotice("Prompt copied");
                }}
              >
                Copy prompt
              </Button>
              <Button
                variant="outline"
                disabled={!prompt}
                onClick={() => {
                  void navigator.clipboard.writeText(prompt);
                  window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
                }}
              >
                Open ChatGPT
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
