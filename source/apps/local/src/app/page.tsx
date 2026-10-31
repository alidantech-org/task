import { App } from "@/components/app-shell";
import { cookies } from "next/headers";

async function getRuntime(): Promise<{
  status: "connected" | "offline";
  workspace: Record<string, unknown> | null;
}> {
  try {
    const port = process.env.TASK_LOCAL_PORT ?? "4317";
    const response = await fetch(`http://127.0.0.1:${port}/health/live`, { cache: "no-store" });
    return { status: response.ok ? "connected" : "offline", workspace: null };
  } catch {
    return { status: "offline", workspace: null };
  }
}

export default async function HomePage() {
  const runtime = await getRuntime();
  return <App runtimeStatus={runtime.status} workspace={runtime.workspace} />;
}
