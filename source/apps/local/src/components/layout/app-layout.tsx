"use client";

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { Button, Input } from "@task/ui";
import { Command as CommandMenu } from "cmdk";
import {
  AlertTriangle,
  Calendar,
  Check,
  type CircleDot,
  File,
  Folder,
  Folder as FolderIcon,
  LayoutGrid,
  ListChecks,
  PanelLeft,
  Plus,
  Search,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import {
  createContext,
  type PointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GlobalNavigation } from "@/components/layout/global-navigation";
import { ShellFrame } from "@/components/layout/shell-frame";
import { CustomSelect } from "@/components/ui/select";
import { dateKey } from "@/lib/calendar";
import { taskDropUpdate } from "@/lib/drop-mutation";
import { restartSectionEntrance } from "@/lib/entrance";
import {
  clampSidebarWidth,
  isArchivedTask,
  parseSidebarPreference,
  type SidebarPreference,
  type StatusChange,
  sortCompletedTasks,
  toggleSidebarPreference,
} from "@/lib/overview";
import { parseQuickAdd } from "@/lib/quick-add";

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
    tracking?: { segments: readonly { ended_at?: string }[] };
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
  archivedTasks: number;
  resolved: number;
};
type Workspace = {
  projectName: string;
  projectRoot: string;
  workspaceRoot: string;
  workspaceDirectory: string;
  organization?: { weekStart?: number; autoArchiveAfterDays?: number | null };
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
type PaletteEntry = { key: string; label: string; detail: string; run(): void };
type LiveChange = { id: string; name: string; status: string; changedAt: string; source: string };
type DocumentConflict = { body: string; contentHash: string };
type AppProps = {
  runtimeStatus: "connected" | "offline";
  workspace: Record<string, unknown> | null;
  workspaceError?: string | null;
  initialPath?: string;
  children?: ReactNode;
};
type WorkspaceAppContextValue = {
  workspace: Workspace | null;
  records: RecordItem[];
  tasks: RecordItem[];
  allTasks: RecordItem[];
  archivedTasks: RecordItem[];
  docs: RecordItem[];
  groups: Group[];
  connectionStatus: "connected" | "offline";
  workspaceError: string | null;
  taskFilter: string | null;
  setTaskFilter(filter: string | null): void;
  taskGroupFilter: string;
  setTaskGroupFilter(filter: string): void;
  selectTaskGroup(groupId: string): void;
  taskView: "List" | "Board" | "Calendar";
  setTaskView(view: "List" | "Board" | "Calendar"): void;
  visibleTasks: RecordItem[];
  selected: RecordItem | null;
  activeSelected: RecordItem | null;
  detail: { body: string; contentHash: string } | null;
  documentDraft: string;
  editingDocument: boolean;
  setDocumentDraft(body: string): void;
  setEditingDocument(editing: boolean): void;
  documentConflict: DocumentConflict | null;
  setDocumentConflict(conflict: DocumentConflict | null): void;
  resolveDocumentConflict(choice: "reload" | "keep"): void;
  documentFolder: string;
  createDocument(): Promise<void>;
  openCreate(date?: string): void;
  openRecord(item: RecordItem | null): void;
  updateTaskStatus(task: RecordItem, status: string): Promise<void>;
  updateTaskDue(task: RecordItem, dueAt: string | null): Promise<void>;
  updateTaskPriority(task: RecordItem, priority: string): Promise<void>;
  setTaskHiddenFromRecent(task: RecordItem, hidden: boolean): Promise<void>;
  setTaskArchived(task: RecordItem, archived: boolean): Promise<void>;
  deleteRecord(
    record: { id: string; name: string },
    kind: "task" | "document" | "task-group",
  ): Promise<boolean>;
  undoDelete(): Promise<void>;
  startTaskTracking(task: RecordItem): Promise<void>;
  saveBody(body: string): Promise<boolean>;
  setNotice(message: string): void;
  refresh(): Promise<void>;
  validate(): Promise<void>;
  migrate(): Promise<void>;
};
const WorkspaceAppContext = createContext<WorkspaceAppContextValue | null>(null);
export function useWorkspaceApp(): WorkspaceAppContextValue {
  const value = useContext(WorkspaceAppContext);
  if (!value) throw new Error("Workspace page must be rendered inside the persistent app layout");
  return value;
}
type ThemeChoice = "system" | "light" | "dark";

const navigation = [
  { label: "Overview", icon: LayoutGrid },
  { label: "Tasks", icon: ListChecks },
  { label: "Calendar", icon: Calendar },
  { label: "Groups", icon: FolderIcon },
  { label: "Documents", icon: File },
];
const _statuses = ["planned", "in-progress", "blocked", "completed", "archived"] as const;
const statusNames: Record<string, string> = {
  planned: "Planned",
  "in-progress": "In progress",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
};

function sectionFromPath(path: string): string {
  const first = path.split("?")[0]?.split("/")[1] ?? "";
  if (first === "tasks") return "Tasks";
  if (first === "calendar") return "Calendar";
  if (first === "groups") return "Groups";
  if (first === "documents") return "Documents";
  if (first === "activity") return "Activity";
  if (first === "prompts") return "Agent prompts";
  if (first === "health") return "Workspace health";
  return "Overview";
}
function sectionPath(label: string): string {
  if (label === "Tasks") return "/tasks";
  if (label === "Calendar") return "/calendar";
  if (label === "Groups") return "/groups";
  if (label === "Documents") return "/documents";
  if (label === "Activity") return "/activity";
  if (label === "Agent prompts") return "/prompts";
  if (label === "Workspace health") return "/health";
  return "/";
}
function documentIdFromPath(path: string): string | null {
  const match = path.match(/^\/documents\/([^/]+)$/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
function folderFromPath(path: string): string {
  const match = path.match(/^\/documents\/folder\/(.+)$/);
  if (!match?.[1]) return "";
  try {
    return match[1].split("/").map(decodeURIComponent).join("/");
  } catch {
    return "";
  }
}
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function _statusVariant(status?: string): "success" | "warning" | "destructive" | "secondary" {
  if (status === "completed") return "success";
  if (status === "in-progress") return "warning";
  if (status === "blocked") return "destructive";
  return "secondary";
}
function formatDate(date?: string): string {
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en", {
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
  if (choice === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = choice;
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
function _Metric({
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
  initialPath = "/",
  children,
}: AppProps) {
  const router = useRouter();
  const pathname = usePathname() ?? initialPath;
  const [workspace, setWorkspace] = useState<Workspace | null>(rawWorkspace as Workspace | null);
  const [connectionStatus, setConnectionStatus] = useState(runtimeStatus);
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveChanges, setLiveChanges] = useState<LiveChange[]>([]);
  const [liveFlashId, setLiveFlashId] = useState<string | null>(null);
  const pageBodyRef = useRef<HTMLElement | null>(null);
  const workspaceRef = useRef<Workspace | null>(rawWorkspace as Workspace | null);
  const section = sectionFromPath(pathname);
  const [taskView, setTaskView] = useState<"List" | "Board" | "Calendar">("Board");
  const [taskFilter, setTaskFilter] = useState<string | null>(null);
  const [taskGroupFilter, setTaskGroupFilter] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [, setSearching] = useState(false);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [detail, setDetail] = useState<{
    body: string;
    contentHash: string;
  } | null>(null);
  const [editingDocument, setEditingDocument] = useState(false);
  const [documentDraft, setDocumentDraft] = useState("");
  const [documentConflict, setDocumentConflict] = useState<DocumentConflict | null>(null);
  const [_savingDocument, setSavingDocument] = useState(false);
  const [documentFolder, setDocumentFolder] = useState(() => folderFromPath(pathname));
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [lastSidebarMode, setLastSidebarMode] = useState<"full" | "mini">("full");
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const [trustedProjects, setTrustedProjects] = useState<TrustedProject[]>([]);
  const [projectPathInput, setProjectPathInput] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [workspaceError, setWorkspaceError] = useState(initialWorkspaceError);
  const [sidebarReady, setSidebarReady] = useState(false);
  const [mobileProjectOpen, setMobileProjectOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [completedLimit, setCompletedLimit] = useState(5);
  const [completedLimitReady, setCompletedLimitReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [undoTrashId, setUndoTrashId] = useState("");
  const [dialog, setDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [group, setGroup] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const creatingDocument = useRef(false);
  const pendingTaskSelection = useRef<string | null>(null);
  const openDocumentRef = useRef({ id: "", editing: false, draft: "", body: "", hash: "" });
  const records = workspace?.documents ?? [];
  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);
  useEffect(() => {
    if (!liveFlashId) return;
    const matching = document.querySelectorAll(
      `[data-tid="${CSS.escape(liveFlashId)}"], [data-fid="${CSS.escape(liveFlashId)}"]`,
    );
    for (const element of matching) element.classList.add("flash");
    const timer = window.setTimeout(() => {
      for (const element of matching) element.classList.remove("flash");
      setLiveFlashId(null);
    }, 2100);
    return () => window.clearTimeout(timer);
  }, [liveFlashId]);
  useEffect(() => {
    if (!notice) {
      setUndoTrashId("");
      return;
    }
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);
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
  const tasks = records.filter((item) => item.type === "task" && !isArchivedTask(item));
  const draggingSidebar = useRef({
    pointerId: -1,
    left: 0,
    width: 240,
  });
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
  const docs = records.filter((item) => item.type !== "task");
  const routeDocumentId = documentIdFromPath(pathname);
  const selectedFromRoute = routeDocumentId
    ? (records.find((item) => item.id === routeDocumentId) ?? null)
    : null;
  const activeSelected = routeDocumentId ? selectedFromRoute : selected;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-run the entrance animation when the active view changes.
  useEffect(() => {
    restartSectionEntrance(pageBodyRef.current);
  }, [documentFolder, routeDocumentId, section, taskView]);
  useEffect(() => {
    openDocumentRef.current = {
      id: activeSelected?.type === "task" ? "" : (activeSelected?.id ?? ""),
      editing: editingDocument,
      draft: documentDraft,
      body: detail?.body ?? "",
      hash: detail?.contentHash ?? "",
    };
  }, [
    activeSelected?.id,
    activeSelected?.type,
    detail?.body,
    documentDraft,
    editingDocument,
    detail?.contentHash,
  ]);

  useEffect(() => {
    const nextSection = sectionFromPath(pathname);
    const nextFolder = folderFromPath(pathname);
    setDocumentFolder(nextFolder);
    const nextId = documentIdFromPath(pathname);
    if (nextId) {
      const match = records.find((item) => item.id === nextId);
      if (match) setSelected(match);
    } else {
      const pendingId = pendingTaskSelection.current;
      if (nextSection === "Tasks" && pendingId) {
        const pendingTask = records.find((item) => item.id === pendingId && item.type === "task");
        if (pendingTask) {
          pendingTaskSelection.current = null;
          setSelected(pendingTask);
        }
      } else {
        if (nextSection !== "Tasks") pendingTaskSelection.current = null;
        if (nextSection !== "Tasks" || selected?.type !== "task") setSelected(null);
      }
      setEditingDocument(false);
      setDocumentConflict(null);
    }
  }, [pathname, records, selected]);

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

  const toggleSidebar = useCallback((): void => {
    const preference = toggleSidebarPreference({
      mode: !sidebarVisible ? "hidden" : sidebarCompact ? "mini" : "full",
      width: sidebarWidth,
      last: lastSidebarMode,
    });
    setSidebarVisible(preference.mode !== "hidden");
    setSidebarCompact(preference.mode === "mini");
    setLastSidebarMode(preference.last);
  }, [lastSidebarMode, sidebarCompact, sidebarVisible, sidebarWidth]);

  const openPalette = useCallback(() => {
    setQuery("");
    setPaletteOpen(true);
  }, []);

  function toggleSidebarCompact(): void {
    if (!sidebarVisible) {
      setSidebarVisible(true);
      setSidebarCompact(lastSidebarMode === "mini");
      return;
    }
    const next = !sidebarCompact;
    setSidebarCompact(next);
    setLastSidebarMode(next ? "mini" : "full");
  }

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
        openPalette();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setLiveOpen(false);
        setMobileProjectOpen(false);
        setProjectSwitcherOpen(false);
        if (dialog) setDialog(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openPalette, toggleSidebar, dialog]);

  useEffect(() => {
    let preference: SidebarPreference = { mode: "full", width: 240, last: "full" };
    try {
      const storage = window.localStorage;
      preference = parseSidebarPreference(storage.getItem("tsb"), {
        compact: storage.getItem("task-sidebar-compact"),
        visible: storage.getItem("task-sidebar-visible"),
        width: storage.getItem("task-sidebar-width"),
      });
    } catch {
      // Keep the default preferences when browser storage is unavailable.
    }
    setSidebarCompact(preference.mode === "mini");
    setSidebarVisible(preference.mode !== "hidden");
    setSidebarWidth(preference.width);
    setLastSidebarMode(preference.last);
    setSidebarReady(true);
  }, []);
  useEffect(() => {
    if (!sidebarReady) return;
    const mode = !sidebarVisible ? "hidden" : sidebarCompact ? "mini" : "full";
    try {
      window.localStorage.setItem("tsb", JSON.stringify([mode, sidebarWidth, lastSidebarMode]));
    } catch {
      // Sidebar preferences are optional when browser storage is unavailable.
    }
  }, [lastSidebarMode, sidebarCompact, sidebarReady, sidebarVisible, sidebarWidth]);
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
    let refreshing = false;
    let refreshPending = false;
    const poll = async () => {
      if (refreshing) {
        refreshPending = true;
        return;
      }
      refreshing = true;
      try {
        const response = await fetch("/api/runtime/workspace", { cache: "no-store" });
        const payload = (await response.json()) as { workspace?: Workspace };
        if (!response.ok || !payload.workspace) throw new Error("Workspace unavailable");
        if (active) {
          setWorkspace(payload.workspace);
          setConnectionStatus("connected");
          setWorkspaceError(null);
        }
      } catch {
        if (active) setConnectionStatus("offline");
      } finally {
        refreshing = false;
        if (active && refreshPending) {
          refreshPending = false;
          void poll();
        }
      }
    };
    const events = new EventSource("/api/runtime/workspace/events", { withCredentials: true });
    events.onopen = () => void poll();
    events.addEventListener("workspace", (rawEvent) => {
      let eventData: { recordId?: string; changedAt?: string; source?: string } = {};
      try {
        eventData = JSON.parse((rawEvent as MessageEvent<string>).data) as typeof eventData;
      } catch {
        void poll();
        return;
      }
      const previous = workspaceRef.current;
      void fetch("/api/runtime/workspace", { cache: "no-store" })
        .then(async (response) => {
          const payload = (await response.json()) as { workspace?: Workspace };
          if (!response.ok || !payload.workspace) throw new Error("Workspace unavailable");
          if (!active) return;
          const next = payload.workspace;
          workspaceRef.current = next;
          setWorkspace(next);
          setConnectionStatus("connected");
          setWorkspaceError(null);
          const before = eventData.recordId
            ? previous?.documents.find((item) => item.id === eventData.recordId)
            : undefined;
          const after = eventData.recordId
            ? next.documents.find((item) => item.id === eventData.recordId)
            : undefined;
          if (eventData.recordId && after && before?.contentHash !== after.contentHash) {
            const source = eventData.source ?? "External";
            const status = after.status ?? "updated";
            const change: LiveChange = {
              id: after.id,
              name: after.name,
              status,
              changedAt: eventData.changedAt ?? new Date().toISOString(),
              source,
            };
            setLiveChanges((current) => [change, ...current].slice(0, 3));
            setLiveFlashId(after.id);
            setNotice(
              `${source} changed ${after.id}${after.status ? ` to ${statusNames[after.status] ?? after.status}` : ""}`,
            );
          }
        })
        .catch(() => {
          if (active) setConnectionStatus("offline");
        });
    });
    events.onerror = () => {
      if (active) setConnectionStatus("offline");
    };
    const timer = window.setInterval(() => void poll(), 30_000);
    return () => {
      active = false;
      events.close();
      window.clearInterval(timer);
    };
  }, []);
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
    if (!activeSelected) {
      setDetail(null);
      setEditingDocument(false);
      setDocumentConflict(null);
      return;
    }
    if (detail?.contentHash === activeSelected.contentHash) return;
    const currentEdit = openDocumentRef.current;
    if (
      currentEdit.id === activeSelected.id &&
      currentEdit.editing &&
      currentEdit.draft !== currentEdit.body
    ) {
      void fetch(`/api/runtime/workspace/document/${encodeURIComponent(activeSelected.id)}`, {
        cache: "no-store",
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            document?: DocumentConflict;
            error?: { message?: string };
          };
          if (!response.ok || !payload.document)
            throw new Error(payload.error?.message ?? "Could not reload changed document");
          if (active && payload.document.contentHash !== currentEdit.hash) {
            setDocumentConflict(payload.document);
          }
        })
        .catch((error: unknown) => {
          if (active)
            setNotice(error instanceof Error ? error.message : "Could not load changed document");
        });
      return;
    }
    setDetail(null);
    setEditingDocument(false);
    setDocumentConflict(null);
    void fetch(`/api/runtime/workspace/document/${encodeURIComponent(activeSelected.id)}`, {
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
  }, [activeSelected, detail]);

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
          const latest = await fetch(
            `/api/runtime/workspace/document/${encodeURIComponent(selected.id)}`,
            { cache: "no-store" },
          );
          const latestPayload = (await latest.json()) as {
            document?: DocumentConflict;
          };
          if (latest.ok && latestPayload.document) setDocumentConflict(latestPayload.document);
          throw new Error(
            "This Markdown file changed on disk. Choose how to resolve the conflict above.",
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

  function resolveDocumentConflict(choice: "reload" | "keep"): void {
    if (!documentConflict) return;
    setDetail(documentConflict);
    if (choice === "reload") {
      setDocumentDraft(documentConflict.body);
      setEditingDocument(false);
    } else {
      setEditingDocument(true);
    }
    setDocumentConflict(null);
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
      router.push("/");
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
  async function deleteRecord(
    record: { id: string; name: string },
    kind: "task" | "document" | "task-group",
  ): Promise<boolean> {
    if (
      !window.confirm(
        `Delete "${record.name}"? It moves to the system temp folder and can be undone until that folder is cleared.`,
      )
    )
      return false;
    try {
      const route = kind === "task-group" ? "task-groups" : kind;
      const cascade = kind === "task-group" ? "?cascade=1" : "";
      const response = await fetch(
        `/api/runtime/workspace/${route}/${encodeURIComponent(record.id)}${cascade}`,
        { method: "DELETE" },
      );
      const payload = (await response.clone().json()) as { trash?: { trashId: string } };
      await acceptWorkspaceResponse(response);
      openRecord(null);
      setNotice(`Deleted ${record.name}`);
      setUndoTrashId(payload.trash?.trashId ?? "");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete");
      return false;
    }
  }
  async function startTaskTracking(task: RecordItem): Promise<void> {
    try {
      const response = await fetch(`/api/runtime/workspace/task/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "in-progress",
          track: true,
          expectedHash: task.contentHash,
        }),
      });
      await acceptWorkspaceResponse(response);
      setNotice("Tracking git changes for this task");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not start tracking");
    }
  }
  async function undoDelete(): Promise<void> {
    const trashId = undoTrashId;
    if (!trashId) return;
    try {
      const response = await fetch(
        `/api/runtime/workspace/trash/${encodeURIComponent(trashId)}/restore`,
        { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      );
      await acceptWorkspaceResponse(response);
      setNotice("Restored");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not restore");
    }
  }
  async function updateTaskStatus(task: RecordItem, status: string): Promise<void> {
    try {
      const response = await fetch(`/api/runtime/workspace/task/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, expectedHash: task.contentHash }),
      });
      await acceptWorkspaceResponse(response);
      setNotice(`Moved to ${statusNames[status] ?? status}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Task update failed");
    }
  }
  async function updateTaskMetadata(
    task: RecordItem,
    update: { dueAt?: string | null; priority?: string },
  ): Promise<void> {
    try {
      const response = await fetch(`/api/runtime/workspace/task/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...update, expectedHash: task.contentHash }),
      });
      await acceptWorkspaceResponse(response);
      setNotice(
        update.dueAt === null
          ? "Moved to Unscheduled"
          : update.dueAt
            ? `Scheduled for ${formatDate(update.dueAt)}`
            : `Priority set to ${update.priority}`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Task update failed");
    }
  }
  async function updateTaskDue(task: RecordItem, dueAt: string | null): Promise<void> {
    await updateTaskMetadata(task, { dueAt });
  }
  async function updateTaskPriority(task: RecordItem, priority: string): Promise<void> {
    await updateTaskMetadata(task, { priority });
  }
  async function setTaskHiddenFromRecent(task: RecordItem, hidden: boolean): Promise<void> {
    try {
      const response = await fetch(`/api/runtime/workspace/task/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hiddenFromRecent: hidden, expectedHash: task.contentHash }),
      });
      await acceptWorkspaceResponse(response);
      setNotice(hidden ? "Hidden from recently finished" : "Shown in recently finished");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update recent task visibility");
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
  async function migrate(): Promise<void> {
    try {
      const response = await fetch("/api/runtime/workspace/migrate", { method: "POST" });
      const payload = (await response.json()) as {
        groups?: Group[];
        workspace?: Workspace;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Migration failed");
      if (payload.workspace) setWorkspace(payload.workspace);
      setNotice(`Moved ${payload.groups?.length ?? 0} legacy group(s) into week folders`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Migration failed");
    }
  }
  function selectSection(label: string) {
    router.push(sectionPath(label));
    if (label === "Tasks") setTaskFilter(null);
    setSelected(null);
    setPaletteOpen(false);
  }
  function selectTaskGroup(groupId: string): void {
    setTaskGroupFilter(groupId);
    if (section !== "Tasks") {
      setTaskFilter(null);
      router.push("/tasks");
    }
  }
  function selectDocumentFolder(path: string) {
    router.push(path ? `/documents/folder/${encodePath(path)}` : "/documents");
    setDocumentFolder(path);
    setSelected(null);
    setEditingDocument(false);
  }

  function openRecord(item: RecordItem | null): void {
    if (!item) {
      router.push(
        section === "Documents" && documentFolder
          ? `/documents/folder/${encodePath(documentFolder)}`
          : sectionPath(section),
      );
      setSelected(null);
      return;
    }
    if (item.type === "task") {
      if (section === "Tasks") {
        setSelected(item);
        return;
      }
      pendingTaskSelection.current = item.id;
      router.push("/tasks");
      return;
    }
    router.push(`/documents/${encodeURIComponent(item.id)}`);
    setSelected(item);
    setEditingDocument(false);
  }
  function openCreate(date = "") {
    setTitle("");
    setNewGroup("");
    setDueDate(date);
    setGroup(workspace?.groups.find((item) => !item.archived && !item.finished)?.id ?? "");
    setDialog(true);
  }

  async function createDocument(): Promise<void> {
    if (creatingDocument.current) return;
    creatingDocument.current = true;
    try {
      const path = `docs/note-${crypto.randomUUID().slice(0, 8)}.md`;
      const response = await fetch("/api/runtime/workspace/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Untitled note",
          path,
          tags: [],
          body: "## Summary\n\nStart writing here. Link other files with [[brief]].\n\n- [ ] First step\n",
        }),
      });
      const payload = (await response.json()) as {
        document?: { metadata?: { id?: string } };
        workspace?: Workspace;
        error?: { message?: string };
      };
      const id = payload.document?.metadata?.id;
      if (!response.ok || !id)
        throw new Error(payload.error?.message ?? "Could not create document");
      if (payload.workspace) setWorkspace(payload.workspace);
      setSelected(null);
      setEditingDocument(false);
      setDocumentConflict(null);
      setPaletteOpen(false);
      setNotice("Document created");
      router.push(`/documents/${encodeURIComponent(id)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create document");
    } finally {
      creatingDocument.current = false;
    }
  }

  function toggleTheme(): void {
    const dark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next: ThemeChoice = dark ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("task-theme", next);
    applyTheme(next);
  }

  function resizeSidebar(event: PointerEvent<HTMLDivElement>): void {
    if (event.type === "pointerdown") {
      if (event.button !== 0) return;
      const shell = event.currentTarget.parentElement;
      if (!shell) return;
      draggingSidebar.current = {
        pointerId: event.pointerId,
        left: shell.getBoundingClientRect().left,
        width: sidebarWidth,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      shell.classList.add("dg");
      event.preventDefault();
      return;
    }
    if (event.type === "pointermove") {
      if (draggingSidebar.current.pointerId !== event.pointerId) return;
      const requestedWidth = event.clientX - draggingSidebar.current.left;
      const shell = event.currentTarget.parentElement;
      if (!shell) return;
      const width = clampSidebarWidth(requestedWidth);
      draggingSidebar.current.width = width;
      shell.style.setProperty("--sw", `${width}px`);
      shell.classList.remove("msb");
      event.currentTarget.setAttribute("aria-valuenow", String(width));
      return;
    }
    if (draggingSidebar.current.pointerId !== event.pointerId) return;
    const shell = event.currentTarget.parentElement;
    const nextWidth = draggingSidebar.current.width;
    draggingSidebar.current.pointerId = -1;
    shell?.classList.remove("dg");
    setSidebarCompact(false);
    setSidebarVisible(true);
    setSidebarWidth(nextWidth);
    setLastSidebarMode("full");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resizeSidebarByKeyboard(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Home") {
      event.preventDefault();
      setSidebarVisible(true);
      setSidebarCompact(true);
      setLastSidebarMode("mini");
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const adjustment = event.key === "ArrowLeft" ? -16 : 16;
    setSidebarVisible(true);
    setSidebarCompact(false);
    setLastSidebarMode("full");
    setSidebarWidth(clampSidebarWidth(sidebarWidth + adjustment));
  }

  function resetSidebarWidth(): void {
    setSidebarVisible(true);
    setSidebarCompact(false);
    setSidebarWidth(240);
    setLastSidebarMode("full");
  }

  async function createTask(): Promise<void> {
    const quickAdd = parseQuickAdd(
      title,
      (workspace?.groups ?? []).filter((item) => !item.archived && !item.finished),
      dueDate,
    );
    if (!quickAdd.title) {
      setNotice("Enter a task title.");
      return;
    }
    setCreating(true);
    try {
      let activeGroup = quickAdd.groupId || group;
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
          title: quickAdd.title,
          group: activeGroup,
          ...(quickAdd.dueDate ? { dueAt: quickAdd.dueDate } : {}),
        }),
      });
      const payload = (await response.json()) as {
        workspace?: Workspace;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not create task");
      if (payload.workspace) setWorkspace(payload.workspace);
      setDialog(false);
      setNewGroup("");
      setSelected(null);
      setNotice("Task created");
      if (quickAdd.dueDate) {
        router.push(`/calendar?date=${encodeURIComponent(quickAdd.dueDate)}`);
      } else {
        setTaskFilter(null);
        setTaskView("Board");
        router.push("/tasks");
      }
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
    const targetDate =
      typeof target?.data.date === "string"
        ? target.data.date
        : target?.data.clearDate === true
          ? null
          : undefined;
    const targetStatus = target?.data.status;
    if (typeof taskId !== "string") return;
    const task = allTasks.find((item) => item.id === taskId);
    if (!task) return;
    const update = taskDropUpdate(
      task,
      {
        ...(targetDate !== undefined ? { date: targetDate } : {}),
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
        update.dueAt === null
          ? "Moved to Unscheduled"
          : update.dueAt
            ? `Scheduled for ${formatDate(update.dueAt)}`
            : `Moved to ${statusNames[update.status ?? ""] ?? update.status}`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Task update failed; refresh and try again",
      );
    }
  }

  const queryText = query.trim().toLocaleLowerCase();
  const fixedEntries: PaletteEntry[] = [
    ...["Overview", "Tasks", "Groups", "Documents", "Agent prompts", "Calendar"].map((label) => ({
      key: `section:${label}`,
      label: `Go to ${label}`,
      detail: "Section",
      run: () => selectSection(label),
    })),
    {
      key: "action:new-task",
      label: "New task",
      detail: "Action",
      run: () => {
        setPaletteOpen(false);
        openCreate();
      },
    },
    {
      key: "action:new-document",
      label: "New document",
      detail: "Action",
      run: () => void createDocument(),
    },
    {
      key: "action:theme",
      label: "Toggle theme",
      detail: "Action",
      run: () => {
        setPaletteOpen(false);
        toggleTheme();
      },
    },
    ...["Activity", "Workspace health"].map((label) => ({
      key: `section:${label}`,
      label: `Go to ${label}`,
      detail: "Section",
      run: () => selectSection(label),
    })),
  ];
  const resultById = new Map<string, SearchResult>();
  for (const result of searchResults) resultById.set(result.id, result);
  for (const record of records) {
    if (
      queryText &&
      `${record.id} ${record.name} ${record.path}`.toLocaleLowerCase().includes(queryText) &&
      !resultById.has(record.id)
    ) {
      resultById.set(record.id, {
        id: record.id,
        name: record.name,
        path: record.path,
        type: record.type,
        snippet: "",
      });
    }
  }
  const recordEntries = [...resultById.values()].map((result) => ({
    key: `record:${result.id}`,
    label:
      result.type === "task" ? `${result.id} — ${result.name}` : `${result.name} — ${result.path}`,
    detail: result.type === "task" ? "Task" : "Document",
    run: () => void selectSearchResult(result),
  }));
  const paletteEntries = [...fixedEntries, ...recordEntries]
    .filter((entry) => entry.label.toLocaleLowerCase().includes(queryText))
    .slice(0, 8);
  const sidebarMode = !sidebarVisible ? "hidden" : sidebarCompact ? "mini" : "full";
  return (
    <DragDropProvider onDragEnd={(event) => void handleDrop(event)}>
      <WorkspaceAppContext.Provider
        value={{
          workspace,
          records,
          tasks,
          allTasks,
          archivedTasks,
          docs,
          groups: (workspace?.groups ?? []).filter((group) => !group.archived && !group.finished),
          connectionStatus,
          workspaceError,
          taskFilter,
          setTaskFilter,
          taskGroupFilter,
          setTaskGroupFilter,
          selectTaskGroup,
          taskView,
          setTaskView,
          visibleTasks,
          selected,
          activeSelected,
          detail,
          documentDraft,
          editingDocument,
          setDocumentDraft,
          setEditingDocument,
          documentConflict,
          setDocumentConflict,
          resolveDocumentConflict,
          documentFolder,
          createDocument,
          openCreate,
          openRecord,
          updateTaskStatus,
          updateTaskDue,
          updateTaskPriority,
          setTaskHiddenFromRecent,
          setTaskArchived,
          deleteRecord,
          undoDelete,
          startTaskTracking,
          saveBody: persistDocumentBody,
          setNotice,
          refresh,
          validate,
          migrate,
        }}
      >
        <ShellFrame
          sidebarMode={sidebarMode}
          sidebarWidth={sidebarWidth}
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
            workspace={workspace}
            projectSwitcherOpen={projectSwitcherOpen}
            setProjectSwitcherOpen={setProjectSwitcherOpen}
            projectPathInput={projectPathInput}
            setProjectPathInput={setProjectPathInput}
            trustedProjects={trustedProjects}
            trustProjectPath={trustProjectPath}
            switchProject={switchProject}
            removeProjectTrust={removeProjectTrust}
            sidebarCompact={sidebarCompact}
            toggleSidebarCompact={toggleSidebarCompact}
            taskCount={tasks.filter((task) => task.status !== "completed").length}
            documentCount={docs.length}
            taskGroups={(workspace?.groups ?? [])
              .filter((item) => !item.archived && !item.finished)
              .map((item) => ({ ...item, total: Math.max(0, item.total - item.archivedTasks) }))}
            taskGroupFilter={taskGroupFilter}
            selectTaskGroup={selectTaskGroup}
            documentPaths={docs.map((doc) => doc.path)}
            documentFolder={documentFolder}
            selectDocumentFolder={selectDocumentFolder}
          />
          <div className="panel" data-slot="task-panel">
            <div className="flex min-h-0 flex-1">
              <main
                data-slot="main-content"
                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              >
                <header data-slot="main-toolbar" className="top shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sidebar-toggle-mobile ib"
                    aria-label={
                      sidebarMode === "hidden"
                        ? "Show sidebar (Ctrl/Cmd+B)"
                        : "Hide sidebar (Ctrl/Cmd+B)"
                    }
                    title={
                      sidebarMode === "hidden"
                        ? "Show sidebar (Ctrl/Cmd+B)"
                        : "Hide sidebar (Ctrl/Cmd+B)"
                    }
                    onClick={toggleSidebar}
                  >
                    <PanelLeft className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`sidebar-toggle-desktop ib ${sidebarMode === "hidden" ? "on" : ""}`}
                    aria-label={
                      sidebarMode === "hidden"
                        ? "Show sidebar (Ctrl/Cmd+B)"
                        : "Hide sidebar (Ctrl/Cmd+B)"
                    }
                    title={
                      sidebarMode === "hidden"
                        ? "Show sidebar (Ctrl/Cmd+B)"
                        : "Hide sidebar (Ctrl/Cmd+B)"
                    }
                    onClick={toggleSidebar}
                  >
                    <PanelLeft className="size-4" />
                  </Button>
                  <button type="button" onClick={openPalette} className="sbtn">
                    <Search className="size-4 shrink-0" />
                    <span className="sbtn-label">Search or jump to…</span>
                    <kbd>⌘K</kbd>
                  </button>
                  <div className="lvw">
                    <button
                      type="button"
                      className="live"
                      aria-expanded={liveOpen}
                      aria-haspopup="dialog"
                      onClick={() => setLiveOpen((open) => !open)}
                    >
                      <Zap className="size-4" />
                      <span>{connectionStatus === "connected" ? "Live" : "Offline"}</span>
                    </button>
                    {liveOpen && (
                      <div className="lvp on" role="dialog" aria-label="Live sync">
                        <b>Live sync</b>
                        <p>
                          Watching {workspace?.workspaceDirectory ?? "the selected workspace"}.
                          Changes made in the workspace appear here as they are indexed.
                        </p>
                        <code className="cli">task move TASK-17 in-progress</code>
                        {liveChanges.map((change) => (
                          <p className="live-change" key={`${change.id}:${change.changedAt}`}>
                            <span className="src">{change.source}</span>
                            <span>
                              {change.id} · {statusNames[change.status] ?? change.status}
                            </span>
                            <small>
                              {new Date(change.changedAt).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </small>
                          </p>
                        ))}
                        {liveChanges.length === 0 && <p>No external changes yet.</p>}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Toggle light and dark theme"
                    title={`Theme: ${theme}`}
                    onClick={toggleTheme}
                    className="ib"
                  >
                    <Sun className="size-4" />
                  </Button>
                  <Button
                    onClick={() => openCreate()}
                    className="cta h-9 rounded-xl px-3 text-xs sm:px-4 sm:text-sm"
                  >
                    <Plus className="size-4" />
                    <span>New task</span>
                  </Button>
                </header>
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
                <section ref={pageBodyRef} className="body min-h-0">
                  <div
                    className={`grid gap-5 ${activeSelected && activeSelected.type !== "task" && section !== "Documents" ? "xl:grid-cols-[minmax(0,1fr)_370px]" : "grid-cols-1"}`}
                  >
                    <div className="min-w-0">{children}</div>
                  </div>
                </section>
              </main>
            </div>
          </div>
          {/* biome-ignore lint/a11y/useSemanticElements: This is a focusable pointer and keyboard resize separator, not a visual divider. */}
          <div
            id="sidebar-resize"
            className="rz hidden md:block"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            aria-valuenow={sidebarCompact ? 68 : sidebarWidth}
            tabIndex={0}
            onPointerDown={resizeSidebar}
            onPointerMove={resizeSidebar}
            onPointerUp={resizeSidebar}
            onPointerCancel={resizeSidebar}
            onDoubleClick={resetSidebarWidth}
            onKeyDown={resizeSidebarByKeyboard}
          />
          <nav aria-label="Mobile workspace navigation" className="mob">
            {navigation.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                aria-current={section === label ? "page" : undefined}
                onClick={() => selectSection(label)}
                className={`nv ${section === label ? "on" : ""}`}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </button>
            ))}
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

          <Dialog.Root open={dialog} onOpenChange={setDialog}>
            <Dialog.Portal>
              <Dialog.Overlay className="new-task-overlay" />
              <Dialog.Content className="new-task-dialog">
                <Dialog.Title className="dialog-title">New task</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Add a task to your workspace. Date and group tokens in the title are applied
                  automatically.
                </Dialog.Description>
                <Input
                  id="new-task-title"
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void createTask();
                  }}
                  placeholder="e.g. Review API fri #docs"
                  aria-label="Task name"
                  className="quick-add-title"
                />
                {workspace?.groups.some((item) => !item.archived && !item.finished) ? (
                  <CustomSelect
                    label="Group"
                    value={group}
                    onValueChange={setGroup}
                    placeholder="Select group…"
                    options={(workspace.groups ?? [])
                      .filter((item) => !item.archived && !item.finished)
                      .map((item) => ({ value: item.id, label: item.name }))}
                  />
                ) : (
                  <Input
                    id="new-task-group-name"
                    value={newGroup}
                    onChange={(event) => setNewGroup(event.target.value)}
                    placeholder="Create your first task group"
                    aria-label="New task group name"
                    className="quick-add-title"
                  />
                )}
                <div className="quick-add-submit">
                  <Button
                    className="cta"
                    disabled={creating || !title.trim() || (!group && !newGroup.trim())}
                    onClick={() => void createTask()}
                  >
                    {creating ? "Creating…" : "Create task"}
                  </Button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          {paletteOpen && (
            <CommandMenu.Dialog
              open={paletteOpen}
              onOpenChange={setPaletteOpen}
              label="Command palette"
              overlayClassName="ov on"
              contentClassName="mdl"
              shouldFilter={false}
              loop
              className="command-menu"
            >
              <div className="command-input-wrap">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <CommandMenu.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  aria-label="Search actions and files"
                  placeholder="Search or jump to…"
                  className="command-input"
                />
              </div>
              <CommandMenu.List className="palette-options mt-2 max-h-[55svh] overflow-y-auto border-t pt-2">
                {paletteEntries.map((entry) => (
                  <CommandMenu.Item
                    key={entry.key}
                    value={entry.key}
                    keywords={[entry.label, entry.detail]}
                    onSelect={entry.run}
                    className="palette-option nv"
                  >
                    <Search className="size-4 shrink-0 text-muted-foreground" />
                    <span>{entry.label}</span>
                  </CommandMenu.Item>
                ))}
                <CommandMenu.Empty className="sub px-3 py-3">No matches.</CommandMenu.Empty>
              </CommandMenu.List>
            </CommandMenu.Dialog>
          )}
          <div role="status" className={`toast ${notice ? "on" : ""}`}>
            <span>{notice}</span>
            {undoTrashId && (
              <button type="button" onClick={() => void undoDelete()}>
                Undo
              </button>
            )}
            <button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        </ShellFrame>
      </WorkspaceAppContext.Provider>
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
      openRecord(current);
      setQuery("");
      setPaletteOpen(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not open this search result");
    }
  }
}
