"use client";

import { Button, Input } from "@task/ui";
import { File, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWorkspaceApp } from "@/components/layout/app-layout";

type DocumentSearchHit = { id: string; snippet: string; type: string };

function plainPreview(body: string): string {
  return body
    .replace(/[#>*`|[\]]|^-+$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function wordCount(body: string): number {
  return body.trim() ? body.trim().split(/\s+/).length : 0;
}

function formattedDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(timestamp),
  );
}

export function DocumentsPage() {
  const {
    docs,
    documentFolder,
    openRecord,
    createDocument: createWorkspaceDocument,
  } = useWorkspaceApp();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [bodySearch, setBodySearch] = useState<{ query: string; hits: Map<string, string> } | null>(
    null,
  );
  const docsRef = useRef(docs);
  const previewHashes = useRef<Record<string, string>>({});
  docsRef.current = docs;
  const normalizedQuery = query.trim().toLocaleLowerCase();

  async function handleCreateDocument(): Promise<void> {
    setCreating(true);
    try {
      await createWorkspaceDocument();
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    let active = true;
    const pending = docs.filter((doc) => previewHashes.current[doc.id] !== doc.contentHash);
    let nextIndex = 0;
    const loaded: Array<{ id: string; contentHash: string; body: string }> = [];
    const loadNext = async () => {
      while (active && nextIndex < pending.length) {
        const doc = pending[nextIndex++];
        if (!doc) continue;
        try {
          const response = await fetch(
            `/api/runtime/workspace/document/${encodeURIComponent(doc.id)}`,
            { cache: "no-store" },
          );
          const payload = (await response.json()) as { document?: { body: string } };
          if (response.ok && payload.document) {
            loaded.push({ id: doc.id, contentHash: doc.contentHash, body: payload.document.body });
          }
        } catch {
          // Leave the hash unset so a later workspace refresh can retry this preview.
        }
      }
    };
    const workers = Array.from({ length: Math.min(8, pending.length) }, () => loadNext());
    void Promise.all(workers).then(() => {
      if (!active) return;
      for (const entry of loaded) previewHashes.current[entry.id] = entry.contentHash;
      setPreviews((current) => {
        const next = { ...current };
        for (const entry of loaded) next[entry.id] = entry.body;
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, [docs]);

  useEffect(() => {
    let active = true;
    if (!normalizedQuery) {
      setBodySearch(null);
      return () => {
        active = false;
      };
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/runtime/workspace/search?q=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
      })
        .then(async (response) => {
          const payload = (await response.json()) as { results?: DocumentSearchHit[] };
          if (!response.ok) throw new Error("Document search failed");
          if (!active) return;
          const documentIds = new Set(docsRef.current.map((doc) => doc.id));
          const hits = new Map(
            (payload.results ?? [])
              .filter((result) => documentIds.has(result.id) && result.type !== "task")
              .map((result) => [result.id, result.snippet]),
          );
          setBodySearch({ query: normalizedQuery, hits });
        })
        .catch(() => {
          if (active) setBodySearch({ query: normalizedQuery, hits: new Map() });
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [normalizedQuery, query]);

  const visible = docs.filter((doc) => {
    if (documentFolder && !doc.path.startsWith(`${documentFolder}/`)) return false;
    if (!normalizedQuery) return true;
    const metadata = `${doc.name} ${doc.path} ${doc.tags.join(" ")}`.toLocaleLowerCase();
    return (
      metadata.includes(normalizedQuery) ||
      (bodySearch?.query === normalizedQuery && bodySearch.hits.has(doc.id))
    );
  });

  return (
    <div className="documents-match">
      <header className="head">
        <div>
          <p className="sub">Plain Markdown files in your project.</p>
          <h1>Documents</h1>
        </div>
        <Button className="cta" onClick={() => void handleCreateDocument()} disabled={creating}>
          <Plus className="size-4" /> {creating ? "Creating…" : "New document"}
        </Button>
      </header>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search titles, tags and content…"
        aria-label="Search documents"
        className="srch"
      />
      <div>
        {visible.map((doc) => {
          const body = previews[doc.id] ?? bodySearch?.hits.get(doc.id) ?? "";
          const excerpt = plainPreview(body);
          return (
            <button key={doc.id} type="button" onClick={() => openRecord(doc)} className="dc">
              <File className="mt-1 size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <b>{doc.name}</b>
                <p>{excerpt ? `${excerpt}…` : ""}</p>
                <small>
                  {doc.path} · {doc.type} · {formattedDate(doc.modifiedAt)} · {wordCount(body)}{" "}
                  words
                  {doc.tags.map((tag) => ` · #${tag}`).join("")}
                </small>
              </span>
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className="sub" style={{ padding: 30, textAlign: "center" }}>
            No documents match.
          </p>
        )}
      </div>
    </div>
  );
}
