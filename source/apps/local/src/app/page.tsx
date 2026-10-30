import { App } from "@/components/app-shell";

async function getRuntimeStatus(): Promise<"connected" | "offline"> {
  const port = process.env.TASK_LOCAL_PORT ?? "4317";
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health/live`, { cache: "no-store" });
    return response.ok ? "connected" : "offline";
  } catch {
    return "offline";
  }
}

export default async function HomePage() {
  return <App runtimeStatus={await getRuntimeStatus()} />;
}
