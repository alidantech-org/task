"use client";

import { Button } from "@task/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CodeViewer } from "@/components/code-viewer";

type ProjectFile = {
  path: string;
  size: number;
  language: string;
  binary: boolean;
  content: string;
};

function parseLines(value: string | null): { from?: number; to?: number } {
  const match = /^(\d+)(?:-(\d+))?$/.exec(value ?? "");
  if (!match) return {};
  return { from: Number(match[1]), to: match[2] ? Number(match[2]) : undefined };
}

function FileViewer() {
  const params = useSearchParams();
  const path = params.get("path") ?? "";
  const { from, to } = parseLines(params.get("L"));
  const [file, setFile] = useState<ProjectFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setFile(null);
    setError(null);
    if (!path) {
      setError("No file path was provided.");
      return;
    }
    void fetch(`/api/runtime/workspace/project-file?path=${encodeURIComponent(path)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          file?: ProjectFile;
          error?: { message?: string };
        };
        if (!active) return;
        if (response.ok && payload.file) setFile(payload.file);
        else setError(payload.error?.message ?? "Could not open this file");
      })
      .catch(() => {
        if (active) setError("Could not reach the local runtime");
      });
    return () => {
      active = false;
    };
  }, [path]);
  const segments = path.split("/").filter(Boolean);
  return (
    <article className="doc-reader-match">
      <header className="dh2">
        <Button asChild variant="ghost" size="sm" className="btn2">
          <Link href="/documents">
            <ArrowLeft className="size-4" />
            Documents
          </Link>
        </Button>
        <nav aria-label="File path" className="sub min-w-0 truncate">
          {segments.join(" / ")}
        </nav>
      </header>
      <div className="body">
        {error && <p role="alert">{error}</p>}
        {!file && !error && <p className="sub">Loading file…</p>}
        {file?.binary && <p className="sub">Binary file ({file.size} bytes) — not shown.</p>}
        {file && !file.binary && (
          <CodeViewer
            code={file.content}
            language={file.language}
            highlightFrom={from}
            highlightTo={to}
          />
        )}
      </div>
    </article>
  );
}

export function FileViewerPage() {
  return (
    <Suspense fallback={<p className="sub">Loading file…</p>}>
      <FileViewer />
    </Suspense>
  );
}
