import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  const { path } = await context.params;
  const cookieStore = await cookies();
  let capability = cookieStore.get("task_runtime_capability")?.value;
  const port = process.env.TASK_LOCAL_PORT ?? "4317";

  if (!capability) {
    const handshake = await fetch(`http://127.0.0.1:${port}/internal/session`, { cache: "no-store" }).catch(() => null);
    if (!handshake?.ok) return NextResponse.json({ error: { message: "Local runtime is offline" } }, { status: 503 });
    const payload = (await handshake.json()) as { capability: string };
    capability = payload.capability;
  }

  const target = `http://127.0.0.1:${port}/${path.join("/")}${new URL(request.url).search}`;
  const headers = new Headers();
  headers.set("x-task-capability", capability);
  const init: RequestInit = { method: request.method, headers, cache: "no-store" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.arrayBuffer();
  const response = await fetch(target, init).catch(() => null);
  if (!response) return NextResponse.json({ error: { message: "Local runtime is offline" } }, { status: 503 });
  const result = new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
  if (!cookieStore.get("task_runtime_capability")) {
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
