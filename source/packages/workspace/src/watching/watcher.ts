import { type FSWatcher, watch } from "node:fs";
import { resolve } from "node:path";
import { reconcileWorkspaceIndex } from "@task/workspace/indexing/incremental";
import type {
  DocumentSummary,
  WorkspaceContext,
  WorkspaceIndex,
} from "@task/workspace/indexing/types";

export type IndexChange =
  | { type: "added" | "updated"; document: DocumentSummary }
  | { type: "removed"; path: string }
  | { type: "invalid"; diagnostic: { path: string; message: string } }
  | { type: "repaired"; path: string }
  | { type: "reset"; index: WorkspaceIndex };
export type IndexChangeListener = (change: IndexChange) => void;
export type WatchOptions = {
  debounceMs?: number;
  reconcileEveryMs?: number;
  onError?: (error: Error) => void;
};
export type WorkspaceWatcher = {
  getSnapshot(): WorkspaceIndex;
  reconcile(): Promise<WorkspaceIndex>;
  close(): void;
};

export function watchWorkspaceIndex(
  context: WorkspaceContext,
  initialIndex: WorkspaceIndex,
  listener: IndexChangeListener,
  options: WatchOptions = {},
): WorkspaceWatcher {
  const root = resolve(context.root);
  let current = initialIndex;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queued = new Set<string>();
  let forceReset = false;
  let running = false;
  let closed = false;
  const debounceMs = Math.max(0, options.debounceMs ?? 80);
  let watcher: FSWatcher;
  const onFilesystemChange = (_event: string, filename: string | Buffer | null): void => {
    if (!filename) forceReset = true;
    else queued.add(String(filename).replaceAll("\\", "/"));
    schedule();
  };
  watcher = watch(root, { recursive: true }, onFilesystemChange);
  watcher.on("error", () => {
    forceReset = true;
    schedule();
  });
  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void reconcile().catch((error: unknown) => {
        if (!closed) options.onError?.(error instanceof Error ? error : new Error(String(error)));
      });
    }, debounceMs);
  }
  async function reconcile(): Promise<WorkspaceIndex> {
    if (running) {
      forceReset = true;
      return current;
    }
    running = true;
    const uncertain = forceReset || queued.size === 0;
    queued = new Set();
    forceReset = false;
    try {
      const next = await reconcileWorkspaceIndex(current);
      const changed: IndexChange[] = [];
      for (const [path, previous] of current.documents) {
        if (!next.documents.has(path)) changed.push({ type: "removed", path });
        else if (next.documents.get(path)?.contentHash !== previous.contentHash) {
          changed.push({ type: "updated", document: next.documents.get(path) as DocumentSummary });
        }
      }
      for (const [path, document] of next.documents) {
        if (!current.documents.has(path)) changed.push({ type: "added", document });
      }
      const oldDiagnostics = new Map(
        current.diagnostics.map((diagnostic) => [diagnostic.path, diagnostic]),
      );
      const nextDiagnostics = new Map(
        next.diagnostics.map((diagnostic) => [diagnostic.path, diagnostic]),
      );
      for (const [path, diagnostic] of nextDiagnostics) {
        if (oldDiagnostics.get(path)?.message !== diagnostic.message) {
          changed.push({ type: "invalid", diagnostic });
        }
      }
      for (const path of oldDiagnostics.keys()) {
        if (!nextDiagnostics.has(path)) changed.push({ type: "repaired", path });
      }
      current = next;
      if (closed) return current;
      if (uncertain) listener({ type: "reset", index: current });
      else for (const change of changed) listener(change);
      return current;
    } finally {
      running = false;
      if (!closed && (forceReset || queued.size > 0)) schedule();
    }
  }
  const interval =
    options.reconcileEveryMs && options.reconcileEveryMs > 0
      ? setInterval(() => {
          forceReset = true;
          schedule();
        }, options.reconcileEveryMs)
      : undefined;
  return {
    getSnapshot: () => current,
    reconcile,
    close() {
      closed = true;
      watcher.close();
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
    },
  };
}
