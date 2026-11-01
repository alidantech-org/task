import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function createSession(port: string): Promise<string | null> {
  const response = await fetch(`http://127.0.0.1:${port}/internal/session`, {
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  const payload = (await response.json()) as { capability?: string };
  return payload.capability ?? null;
}

async function forward(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const allowedOrigins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
    if (!origin || !allowedOrigins.has(origin)) {
      return NextResponse.json(
        { error: { code: "forbidden", message: "Mutation origin is not allowed" } },
        { status: 403 },
      );
    }
  }
  const cookieStore = await cookies();
  let capability = cookieStore.get("task_runtime_capability")?.value;
  let refreshCapabilityCookie = false;
  const port = process.env.TASK_LOCAL_PORT ?? "4317";

  if (!capability) {
    capability = (await createSession(port)) ?? undefined;
    if (!capability)
      return NextResponse.json({ error: { message: "Local runtime is offline" } }, { status: 503 });
    refreshCapabilityCookie = true;
  }

  const target = `http://127.0.0.1:${port}/${path.join("/")}${new URL(request.url).search}`;
  const body =
    request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined;
  const send = (sessionCapability: string) => {
    const headers = new Headers();
    headers.set("x-task-capability", sessionCapability);
    const init: RequestInit = { method: request.method, headers, cache: "no-store" };
    if (body) init.body = body.slice(0);
    return fetch(target, init).catch(() => null);
  };
  let response = await send(capability);
  if (response?.status === 401) {
    const refreshedCapability = await createSession(port);
    if (refreshedCapability) {
      capability = refreshedCapability;
      refreshCapabilityCookie = true;
      response = await send(capability);
    }
  }
  if (!response)
    return NextResponse.json({ error: { message: "Local runtime is offline" } }, { status: 503 });
  const responseHeaders = new Headers({
    "content-type": response.headers.get("content-type") ?? "application/json",
    "cache-control": response.headers.get("cache-control") ?? "no-store",
    "x-content-type-options": "nosniff",
  });
  const disposition = response.headers.get("content-disposition");
  if (disposition) responseHeaders.set("content-disposition", disposition);
  const isEventStream = response.headers.get("content-type")?.startsWith("text/event-stream");
  if (isEventStream) {
    responseHeaders.set("connection", "keep-alive");
    responseHeaders.set("x-accel-buffering", "no");
  }
  const result = new NextResponse(isEventStream ? response.body : await response.arrayBuffer(), {
    status: response.status,
    headers: responseHeaders,
  });
  if (refreshCapabilityCookie) {
    result.cookies.set("task_runtime_capability", capability, {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  }
  return result;
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
