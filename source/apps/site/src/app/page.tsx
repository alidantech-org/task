import { App } from "@/components/app-shell";

async function getApiStatus(): Promise<"connected" | "offline"> {
  const endpoint = process.env.TASK_API_HEALTH_URL ?? "http://127.0.0.1:3000/api/v1/health/live";
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    return response.ok ? "connected" : "offline";
  } catch {
    return "offline";
  }
}

export default async function HomePage() {
  return <App apiStatus={await getApiStatus()} />;
}
