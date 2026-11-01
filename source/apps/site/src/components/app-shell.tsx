import { Badge, Card, CardDescription, CardHeader, CardTitle, Separator } from "@task/ui";
import { Cloud, LockKeyhole, RefreshCw } from "lucide-react";
import type { JSX } from "react";

interface AppProps {
  apiStatus: "connected" | "offline";
}

const principles = [
  {
    icon: LockKeyhole,
    title: "Keep context close",
    description: "Projects and their decisions belong together.",
  },
  {
    icon: RefreshCw,
    title: "Work across surfaces",
    description: "Use local tools or connect when cloud capabilities are ready.",
  },
  {
    icon: Cloud,
    title: "Stay in control",
    description: "Your local workspace remains useful on its own.",
  },
];

export function App({ apiStatus }: AppProps): JSX.Element {
  const connected = apiStatus === "connected";

  return (
    <main className="bg-background text-foreground">
      <section id="home" className="mx-auto max-w-7xl px-5 pt-20 pb-16 sm:px-8 sm:pt-28 lg:pt-36">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Task Cloud
          </p>
          <Badge variant={connected ? "secondary" : "outline"} className="gap-1.5" role="status">
            <span
              className={`size-1.5 rounded-full ${connected ? "bg-emerald-600" : "bg-amber-600"}`}
            />
            {connected ? "API connected" : "API unavailable"}
          </Badge>
        </div>
        <h1 className="mt-6 max-w-4xl text-5xl leading-[1.04] font-semibold tracking-[-0.055em] sm:text-6xl lg:text-7xl">
          Make room for meaningful progress.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          A calm home for your projects and the work behind them. Task Cloud foundations are taking
          shape.
        </p>
        {!connected && (
          <p className="mt-5 max-w-xl text-sm text-muted-foreground">
            Cloud workflows are not available while the Task API is offline.
          </p>
        )}
      </section>

      <section
        className="mx-auto grid max-w-7xl gap-4 px-5 pb-20 sm:grid-cols-3 sm:px-8"
        aria-label="Task principles"
      >
        {principles.map(({ icon: Icon, title, description }) => (
          <Card
            key={title}
            className="border-x-0 border-t-0 rounded-none shadow-none sm:border-x sm:rounded-xl sm:shadow-xs"
          >
            <CardHeader className="gap-3">
              <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
              <div className="space-y-1.5">
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="leading-6">{description}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </section>

      <footer className="mx-auto flex max-w-7xl items-center gap-3 px-5 pb-8 text-xs text-muted-foreground sm:px-8">
        <Separator className="max-w-12" />
        <span>Task Cloud is a foundation; hosted workspace workflows are not implemented.</span>
      </footer>
    </main>
  );
}
