import { App } from "@/components/layout/app-layout";

async function getRuntime(): Promise<{
  status: "connected" | "offline";
  workspace: Record<string, unknown> | null;
  workspaceError: string | null;
}> {
  try {
    const port = process.env.TASK_LOCAL_PORT ?? "4317";
    const base = `http://127.0.0.1:${port}`;
    const ready = await fetch(`${base}/health/ready`, { cache: "no-store" });
    if (!ready.ok) return { status: "offline", workspace: null, workspaceError: null };
    const state = (await ready.json()) as { workspace?: boolean; workspaceError?: string };
    if (!state.workspace) {
      return {
        status: "connected",
        workspace: null,
        workspaceError:
          state.workspaceError ?? "No Task workspace was selected by the local runtime.",
      };
    }
    const session = await fetch(`${base}/internal/session`, { cache: "no-store" });
    if (!session.ok) throw new Error("Could not establish a local runtime session.");
    const capability = ((await session.json()) as { capability: string }).capability;
    const response = await fetch(`${base}/workspace`, {
      headers: { "x-task-capability": capability },
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      workspace?: Record<string, unknown>;
      error?: { message?: string };
    };
    if (!response.ok || !payload.workspace) {
      throw new Error(payload.error?.message ?? "Could not load the selected workspace.");
    }
    return { status: "connected", workspace: payload.workspace, workspaceError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Local workspace connection failed.";
    return { status: "offline", workspace: null, workspaceError: message };
  }
}

export default async function HomePage() {
  const runtime = await getRuntime();
  return (
    <App
      runtimeStatus={runtime.status}
      workspace={runtime.workspace}
      workspaceError={runtime.workspaceError}
    />
  );
}
