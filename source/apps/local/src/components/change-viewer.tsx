"use client";

import { languageForPath } from "@task/workspace/files/language";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { CodeViewer, DiffViewer } from "@/components/code-viewer";

export type ViewerTarget = {
  taskId: string;
  path: string;
  segment: number;
  mode: "diff" | "file";
  denied: boolean;
};

type Loaded = { kind: "diff"; diff: string } | { kind: "file"; content: string; binary: boolean };

function useViewerContent(target: ViewerTarget): { loaded: Loaded | null; error: string | null } {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setLoaded(null);
    setError(null);
    if (target.denied) {
      setError("Contents of protected files are never shown.");
      return;
    }
    const url =
      target.mode === "diff"
        ? `/api/runtime/workspace/task/${encodeURIComponent(target.taskId)}/changes/diff?path=${encodeURIComponent(target.path)}&segment=${target.segment}`
        : `/api/runtime/workspace/project-file?path=${encodeURIComponent(target.path)}`;
    void fetch(url, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          diff?: string;
          file?: { content: string; binary: boolean };
          error?: { message?: string };
        };
        if (!active) return;
        if (response.ok && payload.diff !== undefined)
          setLoaded({ kind: "diff", diff: payload.diff });
        else if (response.ok && payload.file)
          setLoaded({ kind: "file", content: payload.file.content, binary: payload.file.binary });
        else setError(payload.error?.message ?? "Could not load this view");
      })
      .catch(() => {
        if (active) setError("Could not reach the local runtime");
      });
    return () => {
      active = false;
    };
  }, [target]);
  return { loaded, error };
}

/** Full-height diff or file view for one changed file, with a back arrow and the file name in its header. */
export function ChangeViewer({
  target,
  onBack,
  onMode,
}: {
  target: ViewerTarget;
  onBack(): void;
  onMode(mode: "diff" | "file"): void;
}) {
  const { loaded, error } = useViewerContent(target);
  const name = target.path.split("/").pop() ?? target.path;
  const directory = target.path.slice(0, target.path.length - name.length);
  const language = languageForPath(target.path);
  return (
    <div className="change-viewer">
      <header className="viewer-head">
        <button type="button" className="viewer-back" aria-label="Back to changes" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </button>
        <div className="viewer-name" title={target.path}>
          <strong>{name}</strong>
          {directory && <span>{directory}</span>}
        </div>
        <fieldset className="seg viewer-modes" aria-label="Viewer mode">
          {(["diff", "file"] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              className={target.mode === mode ? "on" : ""}
              aria-pressed={target.mode === mode}
              onClick={() => onMode(mode)}
            >
              {mode === "diff" ? "Diff" : "File"}
            </button>
          ))}
        </fieldset>
        <a
          className="viewer-open"
          href={`/files?path=${encodeURIComponent(target.path)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open file in a new tab"
          title="Open file in a new tab"
        >
          <ExternalLink className="size-4" />
        </a>
      </header>
      <div className="viewer-body">
        {error && <p role="alert">{error}</p>}
        {!loaded && !error && <p className="sub">Loading…</p>}
        {loaded?.kind === "diff" && <DiffViewer diff={loaded.diff} language={language} />}
        {loaded?.kind === "file" &&
          (loaded.binary ? (
            <p className="sub">Binary file — not shown.</p>
          ) : (
            <CodeViewer code={loaded.content} language={language} />
          ))}
      </div>
    </div>
  );
}
