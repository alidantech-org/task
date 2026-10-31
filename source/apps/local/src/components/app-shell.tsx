"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Command,
  FileText,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  ListTodo,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  Laptop,
  Timer,
  X,
} from "lucide-react";
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
  Sidebar,
  Separator,
} from "@task/ui";
import { BoardTask, CalendarView, StatusDropZone } from "@/components/calendar";
import { taskDropUpdate } from "@/lib/drop-mutation";

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
};
type ThemeChoice = "system" | "light" | "dark";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Tasks", icon: ListTodo },
  { label: "Calendar", icon: CalendarDays },
  { label: "Projects", icon: FolderKanban },
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
    <Card className="shadow-none">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <span className="grid size-10 place-items-center rounded-xl bg-secondary text-muted-foreground">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}
function recordDescription(item: RecordItem): string {
  return `${item.id} · ${item.path}`;
}

export function App({ runtimeStatus, workspace: rawWorkspace }: AppProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(rawWorkspace as Workspace | null);
  const [section, setSection] = useState("Overview");
  const [taskView, setTaskView] = useState<"List" | "Board">("List");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [detail, setDetail] = useState<{ body: string; contentHash: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
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
  const tasks = records.filter((item) => item.type === "task" && !item.path.startsWith("archive/"));
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
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
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
        if (dialog) setDialog(false);
      }
      if (!typing && event.key.toLowerCase() === "c") {
        event.preventDefault();
        openCreate();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("task-sidebar-collapsed") === "true");
    setSidebarReady(true);
  }, []);
  useEffect(() => {
    if (sidebarReady) window.localStorage.setItem("task-sidebar-collapsed", String(collapsed));
  }, [collapsed, sidebarReady]);
  useEffect(() => {
    void fetch("/api/runtime/workspace", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          workspace?: Workspace;
          error?: { message?: string };
        };
        if (!response.ok) throw new Error(payload.error?.message ?? "Workspace unavailable");
        if (payload.workspace) setWorkspace(payload.workspace);
      })
      .catch((error: unknown) =>
        setNotice(error instanceof Error ? error.message : "Workspace unavailable"),
      );
  }, []);
  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    void fetch(`/api/runtime/workspace/document/${encodeURIComponent(selected.id)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          document?: { body: string; contentHash: string };
          error?: { message?: string };
        };
        if (!response.ok) throw new Error(payload.error?.message ?? "Could not load document");
        setDetail(payload.document ?? null);
      })
      .catch((error: unknown) =>
        setNotice(error instanceof Error ? error.message : "Could not load document"),
      );
  }, [selected]);

  async function acceptWorkspaceResponse(response: Response): Promise<void> {
    const payload = (await response.json()) as {
      workspace?: Workspace;
      error?: { message?: string };
    };
    if (!response.ok)
      throw new Error(payload.error?.message ?? `Request failed (${response.status})`);
    if (payload.workspace) {
      setWorkspace(payload.workspace);
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
      setNotice("Workspace index refreshed");
    } catch (error) {
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
    setSelected(null);
    setMobileNav(false);
    setPaletteOpen(false);
  }
  function openCreate(date = "") {
    setTitle("");
    setDescription("");
    setDueDate(date);
    setGroup(workspace?.groups.find((item) => !item.archived)?.id ?? "");
    setDialog(true);
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
  const mainNav = (
    <>
      <div
        className={`mb-5 rounded-xl border bg-card/70 ${navCompact ? "grid place-items-center p-2" : "p-3"}`}
      >
        {navCompact ? (
          <span
            title={workspace?.projectName ?? "Connect a project"}
            className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground"
          >
            {workspace?.projectName.slice(0, 1).toUpperCase() ?? "?"}
          </span>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
              Workspace
            </p>
            <p className="mt-2 truncate text-sm font-semibold">
              {workspace?.projectName ?? "Connect a project"}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {workspace?.workspaceDirectory ?? "Waiting for local runtime"}
            </p>
          </>
        )}
      </div>
      {!navCompact && (
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
          Workspace
        </p>
      )}
      <nav className="space-y-1">
        {navigation.map(({ label, icon: Icon }) => (
          <button
            key={label}
            title={navCompact ? label : undefined}
            onClick={() => selectSection(label)}
            aria-current={section === label ? "page" : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${navCompact ? "justify-center px-2" : ""} ${section === label ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
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
      <>
        {!navCompact && (
          <p className="mb-2 mt-7 px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
            Manage
          </p>
        )}
        <nav className={`space-y-1 ${navCompact ? "mt-5" : ""}`}>
          {operations.map(({ label, icon: Icon }) => (
            <button
              key={label}
              title={navCompact ? label : undefined}
              onClick={() => selectSection(label)}
              aria-current={section === label ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${navCompact ? "justify-center px-2" : ""} ${section === label ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              <Icon className="size-4 shrink-0" />
              {!navCompact && label}
            </button>
          ))}
        </nav>
        {!navCompact && (
          <>
            <div className="mt-8 rounded-xl border bg-card p-3">
              <p className="flex items-center gap-2 text-xs font-medium">
                <ShieldCheck className="size-4 text-emerald-600" />
                Local and private
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Your workspace files stay on this device.
              </p>
            </div>
          </>
        )}
      </>
    </>
  );

  return (
    <DragDropProvider onDragEnd={(event) => void handleDrop(event)}>
      <main className="min-h-svh bg-background text-foreground">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed((value) => !value)}
          >
            <ChevronLeft
              className={`size-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileNav(true)}
          >
            <ListTodo className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            aria-label="Search workspace"
            onClick={() => setPaletteOpen(true)}
          >
            <Search className="size-4" />
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              T
            </div>
            <span className="font-semibold tracking-tight">Task</span>
            <span className="hidden text-muted-foreground sm:block">/</span>
            <div
              className="hidden max-w-52 items-center gap-2 truncate px-2 py-1.5 text-sm sm:flex"
              title="Active local project"
            >
              <FolderKanban className="size-4 text-muted-foreground" />
              <span className="truncate">{workspace?.projectName ?? "No project"}</span>
            </div>
          </div>
          <div className="relative mx-auto hidden w-full max-w-lg sm:block">
            <InputGroup className="h-9 bg-card">
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
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">⌘ K</kbd>
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search">
                  <X className="size-4" />
                </button>
              )}
            </InputGroup>
            {query.trim() && (
              <div className="absolute top-11 z-40 max-h-96 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-xl">
                {searching ? (
                  <p className="p-3 text-sm text-muted-foreground">Searching workspace…</p>
                ) : matchingSearch.length ? (
                  matchingSearch.map((result) => (
                    <button
                      key={result.path}
                      onClick={() => void selectSearchResult(result)}
                      className="flex w-full items-start gap-3 rounded-lg p-2.5 text-left hover:bg-accent"
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
          <div className="ml-auto flex items-center gap-2">
            <Button
              onClick={() => openCreate()}
              size="icon"
              className="sm:hidden"
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
            <Badge variant={runtimeStatus === "connected" ? "success" : "warning"}>
              <span
                className={`size-1.5 rounded-full ${runtimeStatus === "connected" ? "bg-emerald-600" : "bg-amber-500"}`}
              />
              <span className="hidden sm:inline">
                {runtimeStatus === "connected" ? "Runtime connected" : "Runtime offline"}
              </span>
            </Badge>
            <Button onClick={() => openCreate()} size="sm" className="hidden sm:inline-flex">
              <Plus className="size-4" />
              New task
            </Button>
          </div>
        </header>

        <div
          className={`mx-auto grid min-h-[calc(100svh-4rem)] max-w-[1700px] ${collapsed ? "md:grid-cols-[68px_minmax(0,1fr)]" : "md:grid-cols-[232px_minmax(0,1fr)]"}`}
        >
          <Sidebar className={`hidden p-3 md:block ${collapsed ? "" : "p-4"}`}>{mainNav}</Sidebar>
          {mobileNav && (
            <div
              className="fixed inset-0 z-50 bg-black/40 md:hidden"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setMobileNav(false);
              }}
            >
              <aside className="h-full w-[290px] overflow-y-auto border-r bg-background p-4">
                {mainNav}
              </aside>
            </div>
          )}
          <section className={`min-w-0 px-4 py-6 sm:px-7 sm:py-8 ${selected ? "xl:pr-0" : ""}`}>
            <div
              className={`grid gap-5 ${selected ? "xl:grid-cols-[minmax(0,1fr)_370px]" : "grid-cols-1"}`}
            >
              <div className="min-w-0">
                {section === "Overview" && (
                  <>
                    <p className="text-sm text-muted-foreground">Your workspace, at a glance.</p>
                    <div className="mt-1 flex items-center justify-between">
                      <h1 className="text-3xl font-semibold tracking-tight">
                        {workspace?.projectName ?? "Workspace overview"}
                      </h1>
                      <Button variant="outline" onClick={() => openCreate()}>
                        <Plus className="size-4" />
                        New task
                      </Button>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Metric
                        label="Open tasks"
                        value={workspace?.overview.tasks ?? "—"}
                        icon={ListTodo}
                      />
                      <Metric
                        label="In progress"
                        value={workspace?.overview.inProgress ?? "—"}
                        icon={Timer}
                      />
                      <Metric
                        label="Blocked"
                        value={workspace?.overview.blocked ?? "—"}
                        icon={AlertTriangle}
                      />
                      <Metric
                        label="Documents"
                        value={workspace?.overview.documents ?? "—"}
                        icon={BookOpen}
                      />
                    </div>
                    <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
                      <Card className="shadow-none">
                        <CardHeader>
                          <CardTitle>Recently updated</CardTitle>
                        </CardHeader>
                        <CardContent className="divide-y">
                          {workspace?.overview.recent.slice(0, 6).map((item) => (
                            <button
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
                        </CardContent>
                      </Card>
                      <Card className="shadow-none">
                        <CardHeader>
                          <CardTitle>Needs attention</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            {workspace?.overview.blocked ?? 0} blocked tasks
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {workspace?.overview.diagnostics ?? 0} validation issues
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Workspace snapshot ·{" "}
                            {workspace
                              ? new Date(workspace.scannedAt).toLocaleTimeString()
                              : "waiting"}
                          </p>
                          <Button variant="outline" onClick={() => void validate()}>
                            Run validation
                          </Button>
                        </CardContent>
                      </Card>
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
                        <Button onClick={() => openCreate()}>
                          <Plus className="size-4" />
                          New task
                        </Button>
                      </div>
                    </div>
                    {taskView === "Board" ? (
                      <div className="mt-5 grid gap-3 xl:grid-cols-4">
                        {statuses.map((status) => (
                          <Card key={status} className="min-w-0 bg-muted/25 shadow-none">
                            <CardHeader className="pb-2">
                              <CardTitle className="flex items-center justify-between text-sm">
                                {statusNames[status]}
                                <Badge variant="secondary">
                                  {tasks.filter((task) => task.status === status).length}
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <StatusDropZone status={status}>
                                {tasks
                                  .filter((task) => task.status === status)
                                  .map((task) => (
                                    <div
                                      key={task.id}
                                      className="rounded-xl border bg-card p-3 shadow-sm hover:border-ring"
                                    >
                                      <button
                                        onClick={() => setSelected(task)}
                                        className="w-full text-left"
                                      >
                                        <p className="text-sm font-medium">{task.name}</p>
                                        <p className="mt-2 text-[11px] text-muted-foreground">
                                          {task.id}
                                        </p>
                                      </button>
                                      <div className="mt-2">
                                        <BoardTask task={task} onSelect={() => setSelected(task)} />
                                      </div>
                                    </div>
                                  ))}
                              </StatusDropZone>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-5 overflow-hidden rounded-xl border bg-card">
                        {tasks.map((item) => (
                          <button
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
                {section === "Calendar" && (
                  <>
                    <p className="text-sm text-muted-foreground">A clear view of the work ahead.</p>
                    <div className="mt-1 flex items-center justify-between">
                      <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
                      <Button onClick={() => openCreate()}>
                        <Plus className="size-4" />
                        New task
                      </Button>
                    </div>
                    <CalendarView
                      tasks={tasks}
                      onCreate={openCreate}
                      onSelect={(task) =>
                        setSelected(tasks.find((item) => item.id === task.id) ?? null)
                      }
                    />
                  </>
                )}
                {section === "Documents" && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Browse managed workspace records and Markdown.
                    </p>
                    <h1 className="mt-1 text-3xl font-semibold tracking-tight">Documents</h1>
                    <div className="mt-5 overflow-hidden rounded-xl border bg-card">
                      {docs.map((item) => (
                        <button
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
                {section === "Projects" && (
                  <>
                    <h1 className="text-3xl font-semibold">Projects</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Task groups organize work inside this active local project.
                    </p>
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {workspace?.groups
                        .filter((item) => !item.archived)
                        .map((item) => (
                          <Card key={item.id} className="shadow-none">
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
                      Recent filesystem reconciliation view (source: workspace modified timestamps).
                    </p>
                    <div className="mt-5 space-y-2">
                      {[...records]
                        .sort((a, b) => b.modifiedAt - a.modifiedAt)
                        .slice(0, 30)
                        .map((item) => (
                          <button
                            key={item.path}
                            onClick={() => setSelected(item)}
                            className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left"
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
                    <Card className="mt-5 shadow-none">
                      <CardContent className="space-y-3 p-5">
                        <p>
                          Runtime: <strong>{runtimeStatus}</strong>
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
                <aside className="rounded-2xl border bg-card p-5 xl:sticky xl:top-20 xl:h-[calc(100svh-6rem)] xl:overflow-y-auto">
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
                  <h3 className="text-sm font-semibold">Markdown preview</h3>
                  {detail ? (
                    <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-muted p-3 font-mono text-[11px] leading-5">
                      {detail.body}
                    </pre>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">Loading content…</p>
                  )}
                </aside>
              )}
            </div>
          </section>
        </div>

        {dialog && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDialog(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-title"
              className="w-full max-w-lg rounded-2xl border bg-card p-5 shadow-2xl"
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
                <label className="block text-sm font-medium">
                  Task name
                  <Input
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
                <label className="block text-sm font-medium">
                  Description
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-lg border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Add a few details…"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium">
                    Task group
                    <select
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
                  <label className="text-sm font-medium">
                    Due date
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="mt-1.5 h-9 w-full rounded-lg border bg-background px-3 text-sm"
                    />
                  </label>
                </div>
                {!workspace?.groups.some((item) => !item.archived) && (
                  <label className="block text-sm font-medium">
                    Create your first task group
                    <Input
                      value={newGroup}
                      onChange={(event) => setNewGroup(event.target.value)}
                      placeholder="For example, Website refresh"
                      className="mt-1.5"
                    />
                  </label>
                )}
                {workspace?.groups.length && !group ? (
                  <label className="block text-sm font-medium">
                    Or create a new group
                    <Input
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
          <div
            className="fixed inset-0 z-50 grid place-items-start bg-black/35 px-4 pt-[12vh]"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPaletteOpen(false);
            }}
          >
            <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border bg-popover p-2 shadow-2xl">
              <InputGroup className="border-0 shadow-none focus-within:ring-0">
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
            className="fixed bottom-5 right-5 z-[60] flex max-w-lg items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-xl"
          >
            <Check className="size-4 shrink-0 text-emerald-600" />
            <span>{notice}</span>
            <button aria-label="Dismiss" onClick={() => setNotice("")} className="ml-2">
              <X className="size-4" />
            </button>
          </div>
        )}
      </main>
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
      .map((item) => `- ${item.id} — ${item.name}\n  Path: ${item.path}`)
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
        <Card className="shadow-none">
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
        <Card className="shadow-none">
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
