import { isHealthStatus } from "@task/contracts";
import { App } from "../src/ui/App";

async function getRuntimeStatus(): Promise<"connected" | "offline"> {
  try {
    const response = await fetch("http://127.0.0.1:4317/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) return "offline";
    const payload: unknown = await response.json();
    return isHealthStatus(payload) ? "connected" : "offline";
  } catch {
    return "offline";
  }
}

export default async function HomePage() {
  const runtimeStatus = await getRuntimeStatus();
  return <App runtimeStatus={runtimeStatus} />;
}
