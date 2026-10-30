import { Activity, FileText, FolderKanban, House, ListTodo, ShieldCheck } from "lucide-react";
import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface AppProps {
  runtimeStatus: "connected" | "offline";
}

const navigation = [
  { label: "Overview", icon: House, active: true },
  { label: "Projects", icon: FolderKanban, active: false },
  { label: "Tasks", icon: ListTodo, active: false },
  { label: "Documents", icon: FileText, active: false },
  { label: "Activity", icon: Activity, active: false },
];

export function App({ runtimeStatus }: AppProps): JSX.Element {
  const connected = runtimeStatus === "connected";

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-semibold">T</span>
          </div>
          <span className="text-base font-semibold tracking-tight">Task</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="size-4" />
          <span>Private · on this device</span>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-screen-2xl md:grid-cols-[220px_minmax(0,1fr)]">
        <aside
          className="border-b p-3 md:border-r md:border-b-0 md:p-5"
          aria-label="Workspace navigation"
        >
          <p className="px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Workspace
          </p>
          <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Sections">
            {navigation.map(({ label, icon: Icon, active }) => (
              <span
                key={label}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm ${active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground"}`}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </span>
            ))}
          </nav>
        </aside>

        <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Local workspace
            </p>
            <Badge variant={connected ? "secondary" : "outline"} className="gap-1.5">
              <span
                className={`size-1.5 rounded-full ${connected ? "bg-emerald-600" : "bg-amber-600"}`}
              />
              {connected ? "Runtime connected" : "Runtime offline"}
            </Badge>
          </div>
          <h1 className="mt-5 max-w-2xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Your work, in one place.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            A private workspace stored on your device. Connect a repository workspace to see its
            Task documents and project context here.
          </p>

          <Card className="mt-10 max-w-2xl">
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="text-base">Workspace connection</CardTitle>
                <CardDescription>
                  {connected
                    ? "The local runtime is responding. Workspace discovery is not available yet."
                    : "The local runtime could not be reached. Start it again to restore the connection."}
                </CardDescription>
              </div>
              <Badge variant={connected ? "secondary" : "destructive"} role="status">
                {connected ? "Connected" : "Offline"}
              </Badge>
            </CardHeader>
            <Separator />
            <CardContent className="pt-5 text-sm leading-6 text-muted-foreground">
              No local files are being read or changed by this screen. Workspace discovery and
              document views are not implemented yet.
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
