"use client";

import { languageForPath } from "@task/workspace/files/language";
import { useEffect, useState } from "react";
import type { ViewerTarget } from "@/components/change-viewer";
import { DiffViewer } from "@/components/code-viewer";

type FileChange = {
  path: string;
  oldPath?: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "other";
  insertions: number;
  deletions: number;
  binary: boolean;
  denied: boolean;
};
type Totals = { files: number; insertions: number; deletions: number };
type ChangesPayload = {
  tracked: boolean;
  changes:
    | { available: false; reason: string }
    | {
        available: true;
        segments: { index: number; live: boolean; endError?: string }[];
        files: FileChange[];
        totals: Totals;
        byDirectory: Record<string, Totals>;
        durationMs: number;
      };
};

const previewLines = 12;
const statusLetter: Record<FileChange["status"], string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
  other: "?",
};

function minutes(milliseconds: number): string {
  const total = Math.round(milliseconds / 60_000);
  return total < 60 ? `${total} min` : `${Math.floor(total / 60)} h ${total % 60} min`;
}

function FileDiff({
  taskId,
  file,
  segment,
  limit,
}: {
  taskId: string;
  file: FileChange;
  segment: number;
  limit?: number;
}) {
  const [diff, setDiff] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (file.denied) return;
    void fetch(
      `/api/runtime/workspace/task/${encodeURIComponent(taskId)}/changes/diff?path=${encodeURIComponent(file.path)}&segment=${segment}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const payload = (await response.json()) as { diff?: string; error?: { message?: string } };
        if (!active) return;
        if (response.ok && payload.diff !== undefined) setDiff(payload.diff);
        else setError(payload.error?.message ?? "Could not load diff");
      })
      .catch(() => {
        if (active) setError("Could not load diff");
      });
    return () => {
      active = false;
    };
  }, [taskId, file, segment]);
  if (file.denied) return <p className="sub">Contents of protected files are never shown.</p>;
  if (error) return <p role="alert">{error}</p>;
  if (diff === null) return <p className="sub">Loading diff…</p>;
  return <DiffViewer diff={diff} language={languageForPath(file.path)} limit={limit} />;
}

export function TaskChanges({
  taskId,
  refreshKey,
  showEmpty = false,
  trackedHint = false,
  onView,
}: {
  taskId: string;
  /** Changes whenever the task record changes so the list reloads. */
  refreshKey: string;
  /** Explain the empty state instead of rendering nothing. */
  showEmpty?: boolean;
  trackedHint?: boolean;
  /** Open a file's full diff or contents in the full-height viewer. */
  onView?(target: ViewerTarget): void;
}) {
  const [payload, setPayload] = useState<ChangesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey intentionally reloads the list.
  useEffect(() => {
    let active = true;
    setPayload(null);
    setError(null);
    setOpen(null);
    void fetch(`/api/runtime/workspace/task/${encodeURIComponent(taskId)}/changes`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = (await response.json()) as ChangesPayload & { error?: { message?: string } };
        if (!active) return;
        if (response.ok) setPayload(body);
        else setError(body.error?.message ?? "Could not load changes");
      })
      .catch(() => {
        if (active) setError("Could not load changes");
      });
    return () => {
      active = false;
    };
  }, [taskId, refreshKey]);
  if (error) return <p role="alert">{error}</p>;
  if (!payload && showEmpty && !error) return <p className="sub">Loading changes…</p>;
  if (!payload?.tracked)
    return showEmpty ? (
      <p className="sub">
        {trackedHint
          ? "No snapshots could be read for this task."
          : "File changes are recorded automatically while a task is in progress. Move this task to In progress to start recording."}
      </p>
    ) : null;
  if (!payload.changes.available)
    return <p className="sub">Git changes unavailable: {payload.changes.reason}</p>;
  const { files, totals, segments, byDirectory, durationMs } = payload.changes;
  const live = segments.some((segment) => segment.live);
  const lastSegment = segments.length - 1;
  return (
    <section aria-label="Git changes" className="task-changes">
      <h3>Changes {live && <span className="pill">live</span>}</h3>
      <p className="sub">
        {totals.files} file(s) · <span className="diff-stat-add">+{totals.insertions}</span>{" "}
        <span className="diff-stat-del">-{totals.deletions}</span> · {minutes(durationMs)} in
        progress · {Object.keys(byDirectory).length} folder(s)
      </p>
      <ul className="task-change-list">
        {files.map((file) => (
          <li key={file.path}>
            <button
              type="button"
              aria-expanded={open === file.path}
              onClick={() => setOpen(open === file.path ? null : file.path)}
            >
              <span className="diff-status">{statusLetter[file.status]}</span>
              <span className="min-w-0 truncate">{file.path}</span>
              <span className="diff-stat-add">+{file.insertions}</span>
              <span className="diff-stat-del">-{file.deletions}</span>
            </button>
            {open === file.path && (
              <div className="change-preview">
                <FileDiff taskId={taskId} file={file} segment={lastSegment} limit={previewLines} />
                {onView && (
                  <div className="change-preview-actions">
                    <button
                      type="button"
                      onClick={() =>
                        onView({
                          taskId,
                          path: file.path,
                          segment: lastSegment,
                          mode: "diff",
                          denied: file.denied,
                        })
                      }
                    >
                      View full diff
                    </button>
                    {file.status !== "deleted" && (
                      <button
                        type="button"
                        onClick={() =>
                          onView({
                            taskId,
                            path: file.path,
                            segment: lastSegment,
                            mode: "file",
                            denied: file.denied,
                          })
                        }
                      >
                        View file
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
