"use client";

import type { ChangeEvent as ReactChangeEvent, MouseEvent as ReactMouseEvent } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  CircleDot,
  Command,
  FileText,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  ListTodo,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  X,
} from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Separator } from "@task/ui";

type DocumentItem = {
  path: string;
  id: string;
  name: string;
  type: string;
  tags: string[];
  status?: string;
  priority?: string;
  start_at?: string;
  due_at?: string;
  created_at?: string;
  updated_at?: string;
  archived_at?: string;
  size: number;
  modifiedAt: number;
  contentHash: string;
};

type Workspace = {
  projectName: string;
  projectRoot: string;
  workspaceRoot: string;
  workspaceDirectory: string;
  source: string;
  scannedAt: number;
  overview: {
    tasks: number;
    planned: number;
    inProgress: number;
    blocked: number;
    completed: number;
    documents: number;
    diagnostics: number;
    recent: DocumentItem[];
  };
  documents: DocumentItem[];
  diagnostics: Array<{ path: string; message: string; category?: string }>;
};

interface AppProps {
  runtimeStatus: "connected" | "offline";
  workspace: Record<string, unknown> | null;
}

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "My work", icon: CircleDot },
  { label: "Tasks", icon: ListTodo },
  { label: "Projects", icon: FolderKanban },
  { label: "Documents", icon: FileText },
];
const operations = [
  { label: "Agent prompts", icon: Bot },
  { label: "Activity", icon: Activity },
  { label: "Workspace health", icon: Gauge },
];
const statuses = ["planned", "in-progress", "blocked", "completed"] as const;

function statusLabel(status?: string): string {
  return status === "in-progress" ? "In progress" : status ? status[0]?.toUpperCase() + status.slice(1) : "Document";
}

function statusVariant(status?: string): "success" | "warning" | "destructive" | "secondary" {
  if (status === "completed") return "success";
  if (status === "in-progress") return "warning";
  if (status === "blocked") return "destructive";
  return "secondary";
}

function formatDate(date?: string): string {
  if (!date) return "No date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${date.slice(0, 10)}T12:00:00`));
}

function relativeTime(timestamp: number): string {
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function createPrompt(workspace: Workspace, selected: DocumentItem[]): string {
  const references = selected.map((item) => `- ${item.id} — ${item.name}\n  Path: ${item.path}`).join("\n");
  return `You are working in the Task project at ${workspace.projectRoot}.\n\nUse Task CLI commands (task or tk) to inspect or update managed tasks and documents. Read the referenced files before making changes. Preserve the Markdown YAML frontmatter contract and validate your work with task validate.\n\nSelected workspace context:\n${references || "- No records selected. Add relevant task or document paths before starting."}\n\nPlease review the repository and complete the requested work. Summarize changed files and verification performed.`;
}

function Metric({ label, value, icon: Icon, trend }: { label: string; value: string | number; icon: typeof CircleDot; trend?: string }): JSX.Element {
  return (
    <Card className="group shadow-none transition-colors hover:border-foreground/20">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
          </div>
          <span className="grid size-9 place-items-center rounded-lg bg-secondary text-muted-foreground"><Icon className="size-4" /></span>
        </div>
        {trend && <p className="mt-4 flex items-center gap-1 text-xs text-muted-foreground"><ArrowUpRight className="size-3.5" />{trend}</p>}
      </CardContent>
    </Card>
  );
}

export function App({ runtimeStatus, workspace: rawWorkspace }: AppProps): JSX.Element {
  const [workspaceState, setWorkspaceState] = useState<Workspace | null>(rawWorkspace as Workspace | null);
  const [section, setSection] = useState("Overview");
  const [taskView, setTaskView] = useState<"List" | "Board" | "Timeline">("List");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [detail, setDetail] = useState<{ body: string; contentHash: string } | null>(null);
  const [selectedContext, setSelectedContext] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [token, setToken] = useState("");
  const workspace = workspaceState;
  const documents = workspace?.documents ?? [];
  const tasks = documents.filter((item) => item.type === "task" && !item.path.startsWith("archive/"));
  const docs = documents.filter((item) => item.type !== "task");
  const filtered = useMemo(() => {
    const source = section === "Documents" ? docs : section === "Tasks" || section === "My work" ? tasks : documents;
    const needle = search.trim().toLocaleLowerCase();
    return source.filter((item) => !needle || `${item.name} ${item.id} ${item.type} ${item.path} ${item.tags.join(" ")}`.toLocaleLowerCase().includes(needle));
  }, [documents, docs, section, search, tasks]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    void fetch("/api/runtime/workspace", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { workspace?: Workspace } | null) => {
        if (payload?.workspace) {
          setToken("ready");
          setWorkspaceState(payload.workspace);
        }
      })
      .catch(() => setToken(""));
  }, []);

  useEffect(() => {
    if (!selected || !token) { setDetail(null); return; }
    void fetch(`/api/runtime/workspace/document/${encodeURIComponent(selected.id)}`, { cache: "no-store" }).then((response) => response.json()).then((payload: { document?: { body: string; contentHash: string } }) => {
      setDetail(payload.document ?? null);
    }).catch(() => setDetail(null));
  }, [selected, token]);

  async function refresh(): Promise<void> {
    if (!token) return;
    const response = await fetch("/api/runtime/workspace/refresh", { method: "POST" });
    setNotice(response.ok ? "Workspace index refreshed" : "Could not refresh workspace index");
  }

  async function validate(): Promise<void> {
    if (!token) return;
    const response = await fetch("/api/runtime/workspace/validate", { method: "POST" });
    const result = (await response.json()) as { diagnostics?: Array<{ path: string; message: string }> };
    setNotice(response.ok ? `Validation complete · ${result.diagnostics?.length ?? 0} issue(s)` : "Validation failed");
  }

  function selectSection(label: string): void {
    setSection(label);
    setSelected(null);
    setSearch("");
    setPaletteOpen(false);
  }

  const contentTitle = section === "Overview" ? "Good morning" : section;
  const iconMap = new Map([...navigation, ...operations].map((item) => [item.label, item.icon]));

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><span className="font-semibold">T</span></div>
          <span className="font-semibold tracking-tight">Task</span>
          <span className="hidden text-muted-foreground sm:block">/</span>
          <button className="hidden items-center gap-2 truncate rounded-md px-2 py-1.5 text-sm hover:bg-accent sm:inline-flex" title="Project switching will be available after trusted-project registry support is implemented">
            <span className="grid size-5 place-items-center rounded bg-accent text-[10px] font-semibold">{workspace?.projectName?.slice(0, 1).toUpperCase() ?? "?"}</span>
            <span className="max-w-48 truncate">{workspace?.projectName ?? "No project selected"}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="outline" size="sm" className="hidden gap-2 text-muted-foreground sm:inline-flex" onClick={() => setPaletteOpen(true)}><Search className="size-3.5" />Search<Button variant="secondary" size="sm" className="h-5 px-1.5 text-[10px]">⌘ K</Button></Button>
          <Badge variant={runtimeStatus === "connected" ? "success" : "warning"}><span className={`size-1.5 rounded-full ${runtimeStatus === "connected" ? "bg-emerald-600" : "bg-amber-500"}`} />{runtimeStatus === "connected" ? "Runtime connected" : "Runtime offline"}</Badge>
          <div className="hidden size-8 place-items-center rounded-full border bg-secondary text-xs font-medium sm:grid">AD</div>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-[1600px] md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden border-r p-3 md:block md:p-4">
          <div className="mb-5 rounded-lg bg-secondary/70 p-3">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Workspace</p>
            <p className="mt-2 truncate text-sm font-medium">{workspace?.projectName ?? "Connect a project"}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{workspace?.workspaceDirectory ?? "Waiting for local runtime"}</p>
          </div>
          <p className="px-2 pb-2 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">General</p>
          <nav className="space-y-0.5" aria-label="Main navigation">
            {navigation.map(({ label, icon: Icon }) => <button key={label} onClick={() => selectSection(label)} aria-current={section === label ? "page" : undefined} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${section === label ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"}`}><Icon className="size-4" />{label}{label === "Tasks" && <span className="ml-auto text-xs text-muted-foreground">{tasks.length || ""}</span>}</button>)}
          </nav>
          <p className="mt-7 px-2 pb-2 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Operations</p>
          <nav className="space-y-0.5" aria-label="Workspace operations">
            {operations.map(({ label, icon: Icon }) => <button key={label} onClick={() => selectSection(label)} aria-current={section === label ? "page" : undefined} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${section === label ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"}`}><Icon className="size-4" />{label}</button>)}
          </nav>
          <div className="absolute bottom-5 hidden w-[190px] rounded-lg border bg-card p-3 lg:block xl:w-[198px]">
            <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-emerald-600" />Local and private</div>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Workspace files stay on this device.</p>
          </div>
        </aside>

        <div className="min-w-0">
          <nav className="sticky top-16 z-10 flex gap-1 overflow-x-auto border-b bg-background px-3 py-2 md:hidden" aria-label="Mobile navigation">
            {navigation.slice(0, 5).map(({ label, icon: Icon }) => <button key={label} onClick={() => selectSection(label)} className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-xs ${section === label ? "bg-accent font-medium" : "text-muted-foreground"}`}><Icon className="size-3.5" />{label}</button>)}
          </nav>
          <div className={`grid ${selected ? "xl:grid-cols-[minmax(0,1fr)_370px]" : "grid-cols-1"}`}>
            <section className="min-w-0 px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
              {section === "Overview" ? <div className="space-y-6"><div><p className="text-sm text-muted-foreground">Here’s what’s happening in your workspace.</p><h1 className="mt-2 text-3xl font-semibold">{workspace?.projectName ?? "Connect a workspace"}</h1></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total tasks" value={workspace?.overview.tasks ?? "—"} icon={ListTodo} /><Metric label="In progress" value={workspace?.overview.inProgress ?? "—"} icon={Timer} /><Metric label="Blocked" value={workspace?.overview.blocked ?? "—"} icon={AlertTriangle} /><Metric label="Documents" value={workspace?.overview.documents ?? "—"} icon={BookOpen} /></div><Card className="shadow-none"><CardHeader><CardTitle>Recent work</CardTitle></CardHeader><CardContent>{workspace?.overview.recent.map((item) => <button key={item.path} onClick={() => setSelected(item)} className="flex w-full items-center gap-3 border-b py-3 text-left last:border-0"><FileText className="size-4"/><span className="flex-1 text-sm">{item.name}</span><Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge></button>) ?? <p className="text-sm text-muted-foreground">Runtime connected · no workspace snapshot.</p>}</CardContent></Card><Button variant="outline" onClick={() => void validate()}>Run validation</Button></div> : section === "Agent prompts" ? <div><h1 className="text-3xl font-semibold">Agent prompt builder</h1><div className="mt-6 grid gap-5 xl:grid-cols-2"><Card className="shadow-none"><CardHeader><CardTitle>Choose context</CardTitle></CardHeader><CardContent className="max-h-[500px] space-y-3 overflow-auto">{documents.map((item) => <label key={item.path} className="flex gap-3 text-sm"><input type="checkbox" checked={selectedContext.includes(item.path)} onChange={(event: ReactChangeEvent<HTMLInputElement>) => setSelectedContext((current) => event.target.checked ? [...current, item.path] : current.filter((path) => path !== item.path))}/>{item.name}<span className="text-muted-foreground">{item.path}</span></label>)}<Button onClick={() => setPrompt(createPrompt(workspace ?? ({ projectRoot: "<project-root>" } as Workspace), documents.filter((item) => selectedContext.includes(item.path))))}>Generate prompt</Button></CardContent></Card><Card className="shadow-none"><CardHeader><CardTitle>Review and copy</CardTitle></CardHeader><CardContent><textarea value={prompt} onChange={(event: { target: HTMLTextAreaElement }) => setPrompt(event.target.value)} className="min-h-72 w-full rounded-lg border bg-background p-3 font-mono text-xs"/><Button className="mt-3" disabled={!prompt} onClick={() => { void navigator.clipboard.writeText(prompt); setNotice("Prompt copied"); }}>Copy prompt</Button><Button className="ml-2 mt-3" variant="outline" disabled={!prompt} onClick={() => { void navigator.clipboard.writeText(prompt); window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer"); }}>Open ChatGPT</Button></CardContent></Card></div></div> : section === "Workspace health" ? <div><h1 className="text-3xl font-semibold">Workspace health</h1><Card className="mt-6 shadow-none"><CardContent className="space-y-3 p-5"><p>Runtime: {runtimeStatus}</p><p>Project: {workspace?.projectRoot ?? "Not selected"}</p><p>Managed directory: {workspace?.workspaceDirectory ?? "—"}</p>{workspace?.diagnostics.map((diagnostic) => <p key={diagnostic.path + diagnostic.message} className="text-sm text-amber-700">{diagnostic.path}: {diagnostic.message}</p>)}<Button onClick={() => void refresh()}>Refresh index</Button><Button className="ml-2" variant="outline" onClick={() => void validate()}>Validate</Button></CardContent></Card></div> : section === "Projects" ? <div><h1 className="text-3xl font-semibold">Projects</h1><Card className="mt-6 shadow-none"><CardContent className="p-5"><p>{workspace?.projectName ?? "No project selected"}</p><p className="mt-2 text-sm text-muted-foreground">Trusted project switching is pending the user-level registry.</p></CardContent></Card></div> : <><div className="flex items-end justify-between"><div><p className="text-sm text-muted-foreground">Browse workspace records and Markdown.</p><h1 className="mt-2 text-3xl font-semibold">{section}</h1></div></div><div className="mt-5 flex max-w-lg items-center gap-2 rounded-lg border px-3"><Search className="size-4 text-muted-foreground"/><Input value={search} onChange={(event: { target: HTMLInputElement }) => setSearch(event.target.value)} placeholder={`Search ${section.toLowerCase()}`}/></div>{section === "Tasks" && <div className="mt-5 flex gap-2">{(["List", "Board", "Timeline"] as const).map((view) => <Button key={view} variant={taskView === view ? "secondary" : "ghost"} size="sm" onClick={() => setTaskView(view)}>{view}</Button>)}</div>}{section === "Tasks" && taskView === "Board" ? <div className="mt-5 grid gap-3 lg:grid-cols-4">{statuses.map((status) => <Card key={status} className="shadow-none"><CardHeader><CardTitle>{statusLabel(status)}</CardTitle></CardHeader><CardContent>{filtered.filter((item) => item.status === status).map((item) => <button key={item.path} onClick={() => setSelected(item)} className="mb-2 block w-full rounded-lg border p-3 text-left text-sm">{item.name}<p className="text-xs text-muted-foreground">{item.id}</p></button>)}</CardContent></Card>)}</div> : <div className="mt-5 overflow-hidden rounded-xl border bg-card">{filtered.map((item) => <button key={item.path} onClick={() => setSelected(item)} className="flex w-full items-center gap-3 border-b p-3 text-left last:border-0 hover:bg-accent"><FileText className="size-4 text-muted-foreground"/><span className="flex-1 text-sm">{item.name}<span className="ml-2 text-xs text-muted-foreground">{item.path}</span></span><Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge><span className="text-xs text-muted-foreground">{formatDate(item.due_at)}</span></button>)}</div>}</>}
              {notice && <div role="status" className="fixed right-5 bottom-5 z-50 flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg"><Check className="size-4 text-emerald-600" />{notice}<button aria-label="Dismiss" onClick={() => setNotice("")}><X className="size-4" /></button></div>}
            </section>
            {selected && <aside className="border-t bg-card p-5 xl:sticky xl:top-16 xl:h-[calc(100svh-4rem)] xl:overflow-y-auto xl:border-t-0 xl:border-l"><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground">{selected.id}</p><h2 className="mt-2 text-xl font-semibold leading-7">{selected.name}</h2></div><Button variant="ghost" size="icon" aria-label="Close details" onClick={() => setSelected(null)}><X className="size-4" /></Button></div><div className="mt-4 flex items-center gap-2"><Badge variant={statusVariant(selected.status)}>{statusLabel(selected.status)}</Badge>{selected.priority && <Badge variant="outline">{selected.priority} priority</Badge>}</div><Separator className="my-5" /><div className="grid grid-cols-2 gap-4 text-xs"><div><p className="text-muted-foreground">Start date</p><p className="mt-1 font-medium">{formatDate(selected.start_at)}</p></div><div><p className="text-muted-foreground">Due date</p><p className="mt-1 font-medium">{formatDate(selected.due_at)}</p></div><div><p className="text-muted-foreground">Created</p><p className="mt-1 font-medium">{formatDate(selected.created_at)}</p></div><div><p className="text-muted-foreground">Updated</p><p className="mt-1 font-medium">{formatDate(selected.updated_at)}</p></div></div><div className="mt-5"><p className="text-xs font-medium">Path</p><code className="mt-1 block break-all text-xs text-muted-foreground">{selected.path}</code></div><Separator className="my-5" /><h3 className="text-sm font-semibold">Markdown</h3>{detail ? <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-secondary/60 p-3 font-mono text-[11px] leading-5">{detail.body}</pre> : <p className="mt-3 text-xs text-muted-foreground">Loading document content…</p>}<p className="mt-4 text-[10px] text-muted-foreground">Source editing is disabled until race-safe runtime write operations are available.</p><Button className="mt-3 w-full" variant="outline" disabled><FileText className="size-4" />Edit Markdown</Button></aside>}
          </div>
        </div>
      </div>
      {paletteOpen && <div className="fixed inset-0 z-40 grid place-items-start bg-black/35 px-4 pt-[12vh]" role="presentation" onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}><div className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border bg-popover shadow-2xl"><div className="flex items-center gap-3 border-b px-4"><Search className="size-4 text-muted-foreground" /><input autoFocus value={search} onChange={(event: { target: HTMLInputElement }) => setSearch(event.target.value)} placeholder="Search records or jump to…" className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none" /><kbd className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd></div><div className="p-2"><p className="px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Navigation</p>{[...navigation, ...operations].map(({ label }) => { const Icon = iconMap.get(label) ?? Command; return <button key={label} onClick={() => selectSection(label)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"><Icon className="size-4 text-muted-foreground" />{label}<ArrowDownRight className="ml-auto size-3.5 text-muted-foreground" /></button>; })}{search && <><p className="mt-2 px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Matching records</p>{filtered.slice(0, 8).map((item) => <button key={item.path} onClick={() => { setSelected(item); setPaletteOpen(false); }} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"><FileText className="size-4 text-muted-foreground" /><span className="truncate">{item.name}</span><span className="ml-auto text-[10px] text-muted-foreground">{item.id}</span></button>)}</>}</div></div></div>}
    </main>
  );
}
