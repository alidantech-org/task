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
} from "@task/ui";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  Command,
  EyeOff,
  FileText,
  Folder,
  FolderKanban,
  Gauge,
  Laptop,
  LayoutDashboard,
  ListTodo,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Search,
  Sun,
  Timer,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  type PointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BoardTask, CalendarView, StatusDropZone } from "@/components/calendar";
import { MarkdownBody } from "@/components/markdown-body";
import { ShellFrame } from "@/components/layout/shell-frame";
import { GlobalNavigation } from "@/components/layout/global-navigation";
import { ContextualNavigation } from "@/components/layout/contextual-navigation";
import { PromptBuilder } from "@/components/layout/prompt-builder";
import { dateKey } from "@/lib/calendar";
import { taskDropUpdate } from "@/lib/drop-mutation";
import { listDocumentFolders, toggleMarkdownCheckbox } from "@/lib/markdown";
import {
  clampSidebarWidth,
  completionWeek,
  getRecentCompletedTasks,
  isArchivedTask,
  type StatusChange,
  sortCompletedTasks,
} from "@/lib/overview";

const MarkdownEditor = dynamic(
  () => import("@/components/markdown-editor").then((module) => module.MarkdownEditor),
  {
    ssr: false,
    loading: () => <div className="min-h-72 animate-pulse border-y border-border/60" />,
  },
);

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
  extra?: {
    status_history?: readonly StatusChange[];
    hidden_from_recent?: boolean;
    archived_from?: string;
  };
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
  finished?: boolean;
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
type TrustedProject = { path: string; addedAt: string; active?: boolean };
type SearchResult = {
  path: string;
  id: string;
  name: string;
  type: string;
  snippet: string;
};
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
  archived: "Archived",
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
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [detail, setDetail] = useState<{
    body: string;
    contentHash: string;
  } | null>(null);
  const [editingDocument, setEditingDocument] = useState(false);
  const [documentDraft, setDocumentDraft] = useState("");
  const [savingDocument, setSavingDocument] = useState(false);
  const [documentFolder, setDocumentFolder] = useState("");
  const [collapsedDocumentFolders, setCollapsedDocumentFolders] = useState<string[]>([]);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const [trustedProjects, setTrustedProjects] = useState<TrustedProject[]>([]);
  const [projectPathInput, setProjectPathInput] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [workspaceError, setWorkspaceError] = useState(initialWorkspaceError);
  const [sidebarReady, setSidebarReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [mobileProjectOpen, setMobileProjectOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [completedLimit, setCompletedLimit] = useState(5);
  const [completedLimitReady, setCompletedLimitReady] = useState(false);
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
  const completedTasks = useMemo(
    () =>
      sortCompletedTasks(
        allTasks.filter((task) => task.status === "completed" && !isArchivedTask(task)),
      ),
    [allTasks],
  );
  const archivedTasks = useMemo(
    () => sortCompletedTasks(allTasks.filter(isArchivedTask)),
    [allTasks],
  );
  const tasks = records.filter(
    (item) =>
      item.type === "task" &&
      !item.path.startsWith("todo/_archived/") &&
      !item.path.startsWith("todo/_completed/") &&
      !item.path.startsWith("todo/_archive/"),
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
    if (taskFilter === "archived") return archivedTasks;
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
  }, [archivedTasks, completedTasks, tasks, taskFilter]);
  const recentCompletedTasks = getRecentCompletedTasks(allTasks, completedLimit);
  const boardTasks = useMemo(() => {
    const source = taskFilter ? visibleTasks : tasks.filter((task) => task.status !== "completed");
    if (taskFilter && taskFilter !== "completed") return source;
    const sourceIds = new Set(source.map((task) => task.id));
    const combined = [...source, ...recentCompletedTasks.filter((task) => !sourceIds.has(task.id))];
    const recentCompletedIds = new Set(recentCompletedTasks.map((task) => task.id));
    return [
      ...combined.filter((task) => task.status !== "completed" && !isArchivedTask(task)),
      ...sortCompletedTasks(
        combined.filter((task) => task.status === "completed" && recentCompletedIds.has(task.id)),
      ),
    ];
  }, [recentCompletedTasks, tasks, taskFilter, visibleTasks]);
  const docs = records.filter((item) => item.type !== "task");
  const documentFolders = useMemo(() => listDocumentFolders(docs.map((item) => item.path)), [docs]);
  const visibleDocumentFolders = documentFolders.filter((folder) => {
    const segments = folder.path.split("/");
    return segments
      .slice(0, -1)
      .every(
        (_segment, index) =>
          !collapsedDocumentFolders.includes(segments.slice(0, index + 1).join("/")),
      );
  });
  const visibleDocuments = documentFolder
    ? docs.filter((item) => item.path.startsWith(`${documentFolder}/`))
    : docs;
  const themeIcons = { system: Laptop, light: Sun, dark: Moon };
  const ThemeIcon = themeIcons[theme];

  useEffect(() => {
    const stored = window.localStorage.getItem("task-theme");
    const choice: ThemeChoice = stored === "light" || stored === "dark" ? stored : "system";
    setTheme(choice);
    applyTheme(choice);
  }, []);
  useEffect(() => {
    const stored = Number(window.localStorage.getItem("task-completed-limit"));
    if (stored === 5 || stored === 10 || stored === 20) setCompletedLimit(stored);
    setCompletedLimitReady(true);
  }, []);
  useEffect(() => {
    if (!completedLimitReady) return;
    window.localStorage.setItem("task-completed-limit", String(completedLimit));
  }, [completedLimit, completedLimitReady]);
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
        setSidebarVisible((value) => !value);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setMobileNav(false);
        setMobileProjectOpen(false);
        setProjectSwitcherOpen(false);
        if (dialog) setDialog(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  useEffect(() => {
    setSidebarCompact(window.localStorage.getItem("task-sidebar-compact") === "true");
    setSidebarVisible(window.localStorage.getItem("task-sidebar-visible") !== "false");
    const storedWidth = Number(window.localStorage.getItem("task-sidebar-width"));
    if (Number.isFinite(storedWidth) && storedWidth > 0)
      setSidebarWidth(clampSidebarWidth(storedWidth));
    setSidebarReady(true);
  }, []);
  useEffect(() => {
    if (!sidebarReady) return;
    window.localStorage.setItem("task-sidebar-compact", String(sidebarCompact));
    window.localStorage.setItem("task-sidebar-visible", String(sidebarVisible));
    window.localStorage.setItem("task-sidebar-width", String(sidebarWidth));
  }, [sidebarCompact, sidebarReady, sidebarVisible, sidebarWidth]);
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
    void fetch("/api/runtime/projects/trusted", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          projects?: TrustedProject[];
          error?: { message?: string };
        };
        if (!response.ok)
          throw new Error(payload.error?.message ?? "Could not load trusted projects");
        setTrustedProjects(payload.projects ?? []);
      })
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "Could not load trusted projects");
      });
  }, []);
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

  async function persistDocumentBody(
    body: string,
    successMessage = "Markdown saved",
  ): Promise<boolean> {
    if (!selected || !detail) return false;
    setSavingDocument(true);
    try {
      const response = await fetch(
        `/api/runtime/workspace/document/${encodeURIComponent(selected.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body, expectedHash: detail.contentHash }),
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
      if (payload.workspace) {
        setWorkspace(payload.workspace);
        setSelected((current) =>
          current
            ? (payload.workspace?.documents.find((item) => item.id === current.id) ?? current)
            : current,
        );
      }
      if (payload.document) {
        setDetail(payload.document);
        setDocumentDraft(payload.document.body);
      }
      setNotice(successMessage);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save Markdown");
      return false;
    } finally {
      setSavingDocument(false);
    }
  }

  async function saveDocument(): Promise<void> {
    if (await persistDocumentBody(documentDraft)) setEditingDocument(false);
  }

  async function toggleDocumentTask(index: number, checked: boolean): Promise<void> {
    if (!detail) return;
    const body = toggleMarkdownCheckbox(detail.body, index, checked);
    if (body !== detail.body) await persistDocumentBody(body, "Checklist updated");
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
      const response = await fetch("/api/runtime/workspace/refresh", {
        method: "POST",
      });
      await acceptWorkspaceResponse(response);
      setConnectionStatus("connected");
      setNotice("Workspace index refreshed");
    } catch (error) {
      setConnectionStatus("offline");
      setNotice(error instanceof Error ? error.message : "Could not refresh workspace index");
    }
  }
  async function trustProjectPath(path: string): Promise<void> {
    try {
      const response = await fetch("/api/runtime/projects/trusted", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const payload = (await response.json()) as {
        project?: TrustedProject;
        error?: { message?: string };
      };
      if (!response.ok || !payload.project)
        throw new Error(payload.error?.message ?? "Could not trust project");
      const trustedProject = payload.project;
      setTrustedProjects((current) => [
        ...current.filter((project) => project.path !== trustedProject.path),
        trustedProject,
      ]);
      setProjectPathInput("");
      setNotice(`Trusted ${payload.project.path}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not trust project path");
    }
  }
  async function switchProject(path: string): Promise<void> {
    try {
      const response = await fetch("/api/runtime/projects/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const payload = (await response.json()) as {
        workspace?: Workspace;
        projects?: TrustedProject[];
        error?: { message?: string };
      };
      if (!response.ok || !payload.workspace)
        throw new Error(payload.error?.message ?? "Could not select project");
      setWorkspace(payload.workspace);
      setTrustedProjects(payload.projects ?? []);
      setSelected(null);
      setDetail(null);
      setProjectSwitcherOpen(false);
      setMobileProjectOpen(false);
      setConnectionStatus("connected");
      setNotice(`Switched to ${payload.workspace.projectName}`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Project switch failed; current project remains active",
      );
    }
  }
  async function removeProjectTrust(path: string): Promise<void> {
    try {
      const response = await fetch(`/api/runtime/projects/trusted/${encodeURIComponent(path)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        projects?: TrustedProject[];
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not remove project trust");
      setTrustedProjects(payload.projects ?? []);
      setNotice("Project trust removed. Workspace files were not changed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not remove project trust");
    }
  }
  async function setCompletedHidden(task: RecordItem, hidden: boolean): Promise<void> {
    try {
      const response = await fetch(`/api/runtime/workspace/task/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hiddenFromRecent: hidden,
          expectedHash: task.contentHash,
        }),
      });
      await acceptWorkspaceResponse(response);
      setNotice(hidden ? "Hidden from recent completed tasks" : "Shown in recent completed tasks");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not update completed task visibility",
      );
    }
  }
  async function setTaskArchived(task: RecordItem, archived: boolean): Promise<void> {
    try {
      const action = archived ? "archive" : "restore";
      const response = await fetch(
        `/api/runtime/workspace/task/${encodeURIComponent(task.id)}/${action}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedHash: task.contentHash }),
        },
      );
      await acceptWorkspaceResponse(response);
      setNotice(archived ? "Task moved to archived" : "Task restored to its original group");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update task archive state");
    }
  }
  async function validate(): Promise<void> {
    try {
      const response = await fetch("/api/runtime/workspace/validate", {
        method: "POST",
      });
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
  function selectDocumentFolder(path: string) {
    setDocumentFolder(path);
    setSelected(null);
    setEditingDocument(false);
  }
  function openCreate(date = "") {
    setTitle("");
    setDescription("");
    setDueDate(date);
    setGroup(workspace?.groups.find((item) => !item.archived && !item.finished)?.id ?? "");
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
      const requestedWidth = event.clientX - draggingSidebar.current.left;
      if (requestedWidth < 208) {
        setSidebarCompact(true);
      } else {
        setSidebarCompact(false);
        setSidebarWidth(clampSidebarWidth(requestedWidth));
      }
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
      if (sidebarCompact) return;
      const nextWidth = sidebarWidth - 24;
      if (nextWidth < 208) setSidebarCompact(true);
      else setSidebarWidth(clampSidebarWidth(nextWidth));
      return;
    }
    if (sidebarCompact || !sidebarVisible) {
      setSidebarCompact(false);
      setSidebarVisible(true);
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
  const dueSoonCount = tasks.filter((task) => {
    if (!task.due_at || task.status === "completed") return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const through = new Date(today);
    through.setDate(through.getDate() + 7);
    return task.due_at >= dateKey(today) && task.due_at <= dateKey(through);
  }).length;
  const mobileContextDrawer = mobileNav ? (
    <div className="fixed inset-0 z-50 bg-foreground/25 md:hidden">
      <button
        type="button"
        className="absolute inset-0 size-full"
        aria-label="Close navigation drawer"
        onClick={() => setMobileNav(false)}
      />
      <aside className="relative flex h-full w-[min(84vw,320px)] flex-col border-r border-border/60 bg-background px-3">
        <div className="flex h-12 items-center justify-between border-b border-border/50">
          <span className="text-sm font-medium">{section}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close navigation drawer"
            onClick={() => setMobileNav(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-3 [&_[data-slot=contextual-sidebar]]:!flex [&_[data-slot=contextual-sidebar]]:!w-full">
          <ContextualNavigation
            section={section}
            taskFilter={taskFilter}
            sidebarCompact={sidebarCompact}
            sidebarVisible={sidebarVisible}
            setSidebarVisible={setSidebarVisible}
            sidebarWidth={sidebarWidth}
            tasks={tasks}
            completedTasks={completedTasks}
            archivedTasks={archivedTasks}
            dueSoonCount={dueSoonCount}
            selectSavedView={selectSavedView}
            selectSection={selectSection}
            docs={docs}
            documentFolder={documentFolder}
            selectDocumentFolder={selectDocumentFolder}
            visibleDocumentFolders={visibleDocumentFolders}
            collapsedDocumentFolders={collapsedDocumentFolders}
            setCollapsedDocumentFolders={setCollapsedDocumentFolders}
            groups={workspace?.groups ?? []}
            resizeSidebar={resizeSidebar}
            resizeSidebarByKeyboard={resizeSidebarByKeyboard}
          />
        </div>
        <button
          type="button"
          onClick={() => setMobileProjectOpen(true)}
          className="flex items-center gap-2 border-t border-border/60 py-3 text-left text-sm"
        >
          <FolderKanban className="size-4" />
          {workspace?.projectName ?? "Select project"}
        </button>
      </aside>
    </div>
  ) : null;

  return (
    <DragDropProvider onDragEnd={(event) => void handleDrop(event)}>
      <ShellFrame
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
      >
        <GlobalNavigation
          section={section}
          selectSection={selectSection}
          openCreate={openCreate}
          workspace={workspace}
          projectSwitcherOpen={projectSwitcherOpen}
          setProjectSwitcherOpen={setProjectSwitcherOpen}
          projectPathInput={projectPathInput}
          setProjectPathInput={setProjectPathInput}
          trustedProjects={trustedProjects}
          trustProjectPath={trustProjectPath}
          switchProject={switchProject}
          removeProjectTrust={removeProjectTrust}
        />
        <div className="relative m-2 ml-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background">
          {mobileContextDrawer}
          <header
            data-slot="main-toolbar"
            className="relative z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-3 sm:gap-3 sm:px-5"
          >
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open contextual navigation"
              onClick={() => setMobileNav(true)}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
            {!sidebarVisible && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:inline-flex"
                aria-label="Show contextual sidebar"
                title="Show sidebar (Ctrl/Cmd+B)"
                onClick={() => setSidebarVisible(true)}
              >
                <PanelLeftOpen className="size-4" />
              </Button>
            )}
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
                size="sm"
                className="max-w-36 justify-start truncate px-2 md:hidden"
                aria-label="Switch project"
                onClick={() => setMobileProjectOpen(true)}
              >
                <FolderKanban className="size-4 shrink-0" />
                <span className="truncate">{workspace?.projectName ?? "Project"}</span>
              </Button>
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
            </div>
          </header>
          <div className="flex min-h-0 flex-1">
            {sidebarVisible && (
              <div className="hidden md:flex">
                <ContextualNavigation
                  section={section}
                  taskFilter={taskFilter}
                  sidebarCompact={sidebarCompact}
                  sidebarVisible={sidebarVisible}
                  setSidebarVisible={setSidebarVisible}
                  sidebarWidth={sidebarWidth}
                  tasks={tasks}
                  completedTasks={completedTasks}
                  archivedTasks={archivedTasks}
                  dueSoonCount={dueSoonCount}
                  selectSavedView={selectSavedView}
                  selectSection={selectSection}
                  docs={docs}
                  documentFolder={documentFolder}
                  selectDocumentFolder={selectDocumentFolder}
                  visibleDocumentFolders={visibleDocumentFolders}
                  collapsedDocumentFolders={collapsedDocumentFolders}
                  setCollapsedDocumentFolders={setCollapsedDocumentFolders}
                  groups={workspace?.groups ?? []}
                  resizeSidebar={resizeSidebar}
                  resizeSidebarByKeyboard={resizeSidebarByKeyboard}
                />
              </div>
            )}
            <main
              data-slot="main-content"
              className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-16 md:pb-0"
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
                  className={`grid gap-5 ${selected && !(section === "Documents" && selected.type !== "task") ? "xl:grid-cols-[minmax(0,1fr)_370px]" : "grid-cols-1"}`}
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
                                  .filter((item) => !item.archived && !item.finished)
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
                                {workspace?.groups.filter(
                                  (item) => !item.archived && !item.finished,
                                ).length === 0 && (
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
                                  <CardTitle>Recently completed</CardTitle>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    Latest {completedLimit} completed tasks
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="sr-only" htmlFor="completed-limit">
                                    Number of recent completed tasks
                                  </label>
                                  <select
                                    id="completed-limit"
                                    value={completedLimit}
                                    onChange={(event) =>
                                      setCompletedLimit(Number(event.target.value))
                                    }
                                    className="h-8 rounded-md border bg-background px-2 text-xs"
                                  >
                                    {[5, 10, 20].map((count) => (
                                      <option key={count} value={count}>
                                        Latest {count}
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => selectSavedView("completed")}
                                  >
                                    View all
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="divide-y">
                                {recentCompletedTasks.map((task) => {
                                  const completionEvent = [...(task.extra?.status_history ?? [])]
                                    .reverse()
                                    .find((change) => change.to === "completed");
                                  return (
                                    <div key={task.path} className="flex items-center gap-2 py-2">
                                      <button
                                        type="button"
                                        onClick={() => setSelected(task)}
                                        className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left"
                                      >
                                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                                          <Check className="size-3.5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate text-sm font-medium">
                                            {task.name}
                                          </span>
                                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                            {task.id} · Completed
                                          </span>
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                          {formatDate(completionEvent?.at ?? task.updated_at)}
                                        </span>
                                      </button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 shrink-0"
                                        aria-label={`Hide ${task.name} from recent completed tasks`}
                                        title="Hide from recent completions"
                                        onClick={() => void setCompletedHidden(task, true)}
                                      >
                                        <EyeOff className="size-4" />
                                      </Button>
                                    </div>
                                  );
                                })}
                                {recentCompletedTasks.length === 0 && (
                                  <p className="py-4 text-sm text-muted-foreground">
                                    No visible tasks in this recent completion window.
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="flex-row items-center justify-between">
                                <div>
                                  <CardTitle>Archived</CardTitle>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    Archived separately from completed work
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => selectSavedView("archived")}
                                >
                                  View all
                                </Button>
                              </CardHeader>
                              <CardContent className="divide-y">
                                {archivedTasks.slice(0, 5).map((task) => (
                                  <button
                                    type="button"
                                    key={task.path}
                                    onClick={() => setSelected(task)}
                                    className="flex w-full items-center gap-3 py-3 text-left"
                                  >
                                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-medium">
                                        {task.name}
                                      </span>
                                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                        {task.id} · Archived
                                      </span>
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                      {formatDate(task.archived_at)}
                                    </span>
                                  </button>
                                ))}
                                {archivedTasks.length === 0 && (
                                  <p className="py-4 text-sm text-muted-foreground">
                                    Archived tasks will appear here.
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
                                    variant={
                                      connectionStatus === "connected" ? "success" : "warning"
                                    }
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
                                <p className="text-sm text-muted-foreground">
                                  Workspace shortcuts.
                                </p>
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
                            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                              {section}
                            </h1>
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
                                      {boardTasks.filter((task) => task.status === status).length}
                                    </Badge>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <StatusDropZone status={status}>
                                    {boardTasks
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
                                              {isArchivedTask(task) ? " · Archived" : ""}
                                            </p>
                                          </button>
                                          {!isArchivedTask(task) &&
                                            !task.path.startsWith("todo/_completed/") && (
                                              <div className="mt-2">
                                                <BoardTask
                                                  task={task}
                                                  onSelect={() => setSelected(task)}
                                                />
                                              </div>
                                            )}
                                        </div>
                                      ))}
                                  </StatusDropZone>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : taskView === "Calendar" ? (
                          <CalendarView
                            tasks={
                              taskFilter === "archived" || taskFilter === "completed"
                                ? []
                                : visibleTasks.filter(
                                    (task) => task.status !== "completed" && !isArchivedTask(task),
                                  )
                            }
                            recentCompleted={recentCompletedTasks.map((task) => ({
                              id: task.id,
                              name: task.name,
                              status: task.status,
                              archived: false,
                            }))}
                            onCreate={openCreate}
                            onSelect={(task) =>
                              setSelected(records.find((item) => item.id === task.id) ?? null)
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
                      <div className="mt-2 grid min-h-[calc(100svh-9rem)] grid-cols-1 gap-0">
                        <div className="min-w-0">
                          {selected && selected.type !== "task" ? (
                            <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-8 sm:py-7">
                              <div className="flex flex-wrap items-center gap-2 border-b border-border/70 pb-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelected(null);
                                    setEditingDocument(false);
                                  }}
                                >
                                  <ChevronRight className="size-4 rotate-180" />
                                  Documents
                                </Button>
                                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                  {selected.path}
                                </span>
                                {detail && !editingDocument && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setDocumentDraft(detail.body);
                                      setEditingDocument(true);
                                    }}
                                  >
                                    Edit document
                                  </Button>
                                )}
                                {detail && editingDocument && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={savingDocument}
                                      onClick={() => {
                                        setDocumentDraft(detail.body);
                                        setEditingDocument(false);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={savingDocument || documentDraft === detail.body}
                                      onClick={() => void saveDocument()}
                                    >
                                      {savingDocument ? "Saving…" : "Save changes"}
                                    </Button>
                                  </>
                                )}
                              </div>
                              <header className="py-7">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline">{selected.type}</Badge>
                                  <span>{selected.id}</span>
                                </div>
                                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                                  {selected.name}
                                </h1>
                              </header>
                              {detail ? (
                                editingDocument ? (
                                  <MarkdownEditor
                                    key={selected.id}
                                    value={documentDraft}
                                    onChange={setDocumentDraft}
                                    onError={setNotice}
                                    className="min-h-[60vh] border-y border-border/70"
                                  />
                                ) : (
                                  <MarkdownBody
                                    body={detail.body}
                                    onToggleTask={(index, checked) =>
                                      void toggleDocumentTask(index, checked)
                                    }
                                    taskUpdatesDisabled={savingDocument}
                                  />
                                )
                              ) : (
                                <p className="border-y border-border/70 py-6 text-sm text-muted-foreground">
                                  Loading document…
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="px-4 py-5 sm:px-8 sm:py-7">
                              <p className="text-sm text-muted-foreground">
                                Browse managed Markdown by folder.
                              </p>
                              <div className="mt-1 flex items-end justify-between gap-4">
                                <div>
                                  <h1 className="text-3xl font-semibold tracking-tight">
                                    Documents
                                  </h1>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {documentFolder || "All folders"} · {visibleDocuments.length}{" "}
                                    documents
                                  </p>
                                </div>
                              </div>
                              <div className="mt-5 divide-y divide-border/70 border-y border-border/70">
                                {visibleDocuments.map((item) => (
                                  <button
                                    type="button"
                                    key={item.path}
                                    onClick={() => {
                                      setSelected(item);
                                      setEditingDocument(false);
                                    }}
                                    className="flex w-full items-center gap-3 py-3.5 text-left hover:bg-accent/40"
                                  >
                                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-medium">
                                        {item.name}
                                      </span>
                                      <span className="block truncate text-xs text-muted-foreground">
                                        {item.path}
                                      </span>
                                    </span>
                                    <Badge variant="outline">{item.type}</Badge>
                                    <ChevronRight className="size-4 text-muted-foreground" />
                                  </button>
                                ))}
                                {visibleDocuments.length === 0 && (
                                  <p className="py-8 text-center text-sm text-muted-foreground">
                                    No Markdown documents in this folder.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {section === "Groups" && (
                      <>
                        <h1 className="text-3xl font-semibold">Groups</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Task groups organize work inside this active local project.
                        </p>
                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                          {workspace?.groups
                            .filter((item) => !item.archived && !item.finished)
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
                        {workspace?.groups.some((item) => item.finished) && (
                          <section className="mt-8">
                            <h2 className="text-sm font-semibold">Completed groups</h2>
                            <div className="mt-2 divide-y border-y border-border/70">
                              {workspace.groups
                                .filter((item) => item.finished)
                                .map((item) => (
                                  <div key={item.id} className="flex items-center gap-3 py-3">
                                    <Check className="size-4 text-muted-foreground" />
                                    <span className="min-w-0 flex-1 truncate text-sm">
                                      {item.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {item.path}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </section>
                        )}
                        {workspace?.groups.some((item) => item.archived) && (
                          <section className="mt-8">
                            <h2 className="text-sm font-semibold">Archived groups</h2>
                            <div className="mt-2 divide-y border-y border-border/70">
                              {workspace.groups
                                .filter((item) => item.archived)
                                .map((item) => (
                                  <div key={item.id} className="flex items-center gap-3 py-3">
                                    <Folder className="size-4 text-muted-foreground" />
                                    <span className="min-w-0 flex-1 truncate text-sm">
                                      {item.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {item.path}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </section>
                        )}
                      </>
                    )}
                    {section === "Agent prompts" && (
                      <PromptBuilder
                        records={records}
                        workspace={workspace}
                        setNotice={setNotice}
                      />
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
                              <code className="text-xs">
                                {workspace?.workspaceDirectory ?? "—"}
                              </code>
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
                  {selected && !(section === "Documents" && selected.type !== "task") && (
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
                      {selected.type === "task" && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={isArchivedTask(selected) ? "secondary" : "outline"}
                            onClick={() =>
                              void setTaskArchived(selected, !isArchivedTask(selected))
                            }
                          >
                            <Folder className="size-4" />
                            {isArchivedTask(selected)
                              ? selected.extra?.archived_from
                                ? "Restore task"
                                : "Restore group"
                              : "Archive task"}
                          </Button>
                          {selected.status === "completed" && !isArchivedTask(selected) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void setCompletedHidden(
                                  selected,
                                  !selected.extra?.hidden_from_recent,
                                )
                              }
                            >
                              <EyeOff className="size-4" />
                              {selected.extra?.hidden_from_recent
                                ? "Show in recent"
                                : "Hide in recent"}
                            </Button>
                          )}
                        </div>
                      )}
                      {selected.type !== "task" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => {
                            setDocumentFolder(selected.path.split("/").slice(0, -1).join("/"));
                            setSection("Documents");
                          }}
                        >
                          Open full document
                          <ChevronRight className="size-4" />
                        </Button>
                      )}
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
                      <p className="mt-4 break-all text-xs text-muted-foreground">
                        {selected.path}
                      </p>
                      <Separator className="my-5" />
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold">
                          {editingDocument ? "Markdown editor" : "Markdown preview"}
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
                            <MarkdownEditor
                              key={selected.id}
                              value={documentDraft}
                              onChange={setDocumentDraft}
                              onError={setNotice}
                              className="mt-3 border-y border-border/70"
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
                          <div className="mt-3 border-y border-border/60 py-3">
                            <MarkdownBody
                              body={detail.body}
                              onToggleTask={(index, checked) =>
                                void toggleDocumentTask(index, checked)
                              }
                              taskUpdatesDisabled={savingDocument}
                            />
                          </div>
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
        </div>
        <nav
          aria-label="Mobile workspace navigation"
          className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-border/70 bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              aria-current={section === label ? "page" : undefined}
              onClick={() => selectSection(label)}
              className={`grid size-10 place-items-center rounded-xl ${section === label ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            >
              <Icon className="size-5" />
            </button>
          ))}
          <button
            type="button"
            aria-label="Create task"
            onClick={() => openCreate()}
            className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"
          >
            <Pencil className="size-4" />
          </button>
        </nav>
        {mobileProjectOpen && (
          <div className="fixed inset-0 z-[60] grid place-items-end bg-foreground/25 md:hidden">
            <button
              type="button"
              className="absolute inset-0 size-full"
              aria-label="Close project switcher"
              onClick={() => setMobileProjectOpen(false)}
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Switch project"
              className="max-h-[75svh] w-full overflow-y-auto rounded-t-2xl border border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Trusted projects</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close project switcher"
                  onClick={() => setMobileProjectOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
              {trustedProjects.map((project) => (
                <button
                  key={project.path}
                  type="button"
                  disabled={project.active}
                  onClick={() => void switchProject(project.path)}
                  className="flex w-full items-center gap-3 border-b border-border/60 py-3 text-left disabled:opacity-70"
                >
                  <Folder className="size-4" />
                  <span className="min-w-0 flex-1 truncate text-sm">{project.path}</span>
                  {project.active && <Check className="size-4 text-primary" />}
                </button>
              ))}
              {workspace &&
                !trustedProjects.some((project) => project.path === workspace.projectRoot) && (
                  <Button
                    className="mt-3 w-full"
                    variant="outline"
                    onClick={() => void trustProjectPath(workspace.projectRoot)}
                  >
                    Trust current project
                  </Button>
                )}
              <form
                className="mt-4 space-y-2 border-y border-border/60 py-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (projectPathInput.trim()) void trustProjectPath(projectPathInput.trim());
                }}
              >
                <label
                  htmlFor="mobile-trusted-project-path"
                  className="text-xs text-muted-foreground"
                >
                  Add a project folder
                </label>
                <div className="flex gap-2">
                  <Input
                    id="mobile-trusted-project-path"
                    value={projectPathInput}
                    onChange={(event) => setProjectPathInput(event.target.value)}
                    placeholder="/path/to/project"
                    className="h-9 min-w-0 text-xs"
                  />
                  <Button type="submit" size="sm" disabled={!projectPathInput.trim()}>
                    Trust
                  </Button>
                </div>
              </form>
              {trustedProjects
                .filter((project) => !project.active)
                .map((project) => (
                  <Button
                    key={`remove:${project.path}`}
                    className="mt-2 w-full justify-start"
                    variant="ghost"
                    onClick={() => void removeProjectTrust(project.path)}
                  >
                    <X className="size-4" />
                    Remove trust · {project.path}
                  </Button>
                ))}
            </section>
          </div>
        )}

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
              className="relative z-10 max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-card p-5"
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
                <fieldset className="min-w-0">
                  <legend className="mb-1.5 text-sm font-medium">Description</legend>
                  <MarkdownEditor
                    key="new-task-description"
                    value={description}
                    onChange={setDescription}
                    onError={setNotice}
                    className="min-h-56 border-y border-border/70"
                  />
                </fieldset>
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
                        .filter((item) => !item.archived && !item.finished)
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
                {!workspace?.groups.some((item) => !item.archived && !item.finished) && (
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
      </ShellFrame>
    </DragDropProvider>
  );

  async function selectSearchResult(result: SearchResult): Promise<void> {
    try {
      const response = await fetch("/api/runtime/workspace", {
        cache: "no-store",
      });
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
