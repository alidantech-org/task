import { isHealthStatus } from "@task/contracts";
import { App } from "../src/ui/App";

async function getApiStatus(): Promise<"connected" | "offline"> {
  const apiUrl = process.env.TASK_API_URL ?? "http://127.0.0.1:3000";
  try {
    const response = await fetch(new URL("/health", apiUrl), {
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
  const apiStatus = await getApiStatus();
  return <App apiStatus={apiStatus} />;
}
