"use client";

import { Button } from "@task/ui";
import { LayoutGrid, List, Plus, Rows3, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { usePersistentState } from "@/lib/persistent-state";

type DocumentSearchHit = { id: string; snippet: string; type: string };
type DocView = "list" | "table" | "grid";
const docViews: readonly DocView[] = ["list", "table", "grid"];
const isDocView = (value: unknown): value is DocView =>
  typeof value === "string" && (docViews as readonly string[]).includes(value);

function wordCount(body: string): number {
  return body.trim() ? body.trim().split(/\s+/).length : 0;
}

function formattedDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(timestamp),
  );
}

/** A stable hue per tag so the same tag always has the same colour. */
function tagHue(tag: string): number {
  let hash = 0;
  for (const char of tag) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

function DocIcon() {
  return (
    <svg className="doc-icon" viewBox="0 0 32 40" aria-hidden="true">
      <path
        d="M4 2h16l8 8v26a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"
        className="doc-page"
      />
      <path d="M20 2v6a2 2 0 0 0 2 2h6" className="doc-fold" />
      <text x="15" y="29" textAnchor="middle" className="doc-label">
        MD
      </text>
    </svg>
  );
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`dchip ${className}`.trim()}>{children}</span>;
}

type Row = {
  id: string;
  name: string;
  path: string;
  type: string;
  tags: string[];
  modifiedAt: number;
};

export function DocumentsPage() {
  const {
    docs,
    documentFolder,
    openRecord,
    createDocument: createWorkspaceDocument,
  } = useWorkspaceApp();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [view, setView] = usePersistentState<DocView>("documents:view", "list", isDocView);
  const [creating, setCreating] = useState(false);
  const [words, setWords] = useState<Record<string, number>>({});
  const [bodySearch, setBodySearch] = useState<{ query: string; ids: Set<string> } | null>(null);
  const docsRef = useRef(docs);
  const loadedHashes = useRef<Record<string, string>>({});
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

  // Word counts need each body, so they load in the background while the row shows a shimmer.
  useEffect(() => {
    let active = true;
    const pending = docs.filter((doc) => loadedHashes.current[doc.id] !== doc.contentHash);
    let nextIndex = 0;
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
          if (response.ok && payload.document && active) {
            loadedHashes.current[doc.id] = doc.contentHash;
            const count = wordCount(payload.document.body);
            setWords((current) => ({ ...current, [doc.id]: count }));
          }
        } catch {
          // A later refresh retries this document.
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(6, pending.length) }, () => loadNext()));
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
          setBodySearch({
            query: normalizedQuery,
            ids: new Set(
              (payload.results ?? [])
                .filter((result) => documentIds.has(result.id) && result.type !== "task")
                .map((result) => result.id),
            ),
          });
        })
        .catch(() => {
          if (active) setBodySearch({ query: normalizedQuery, ids: new Set() });
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [normalizedQuery, query]);

  const visible: Row[] = docs.filter((doc) => {
    if (documentFolder && !doc.path.startsWith(`${documentFolder}/`)) return false;
    if (tag && !doc.tags.includes(tag)) return false;
    if (!normalizedQuery) return true;
    const metadata = `${doc.name} ${doc.path} ${doc.tags.join(" ")}`.toLocaleLowerCase();
    return (
      metadata.includes(normalizedQuery) ||
      (bodySearch?.query === normalizedQuery && bodySearch.ids.has(doc.id))
    );
  });

  const chips = (doc: Row) => {
    const count = words[doc.id];
    return (
      <span className="dchips">
        <Chip className="type">{doc.type}</Chip>
        {doc.tags.slice(0, 3).map((name) => (
          <button
            type="button"
            key={name}
            className={`dchip tag ${tag === name ? "on" : ""}`}
            style={{ "--h": tagHue(name) } as React.CSSProperties}
            title={`Filter by #${name}`}
            onClick={(event) => {
              event.stopPropagation();
              setTag(tag === name ? "" : name);
            }}
          >
            #{name}
          </button>
        ))}
        <Chip>{formattedDate(doc.modifiedAt)}</Chip>
        {count === undefined ? (
          <span className="dchip shimmer" aria-hidden="true" />
        ) : (
          <Chip>{count} words</Chip>
        )}
      </span>
    );
  };

  return (
    <div className="documents-match docs2">
      <header className="docs-bar">
        <h1>
          Documents <small>{visible.length}</small>
        </h1>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles, tags and content…"
          aria-label="Search documents"
          className="docs-search"
        />
        {tag ? (
          <button
            type="button"
            className="dchip tag on"
            style={{ "--h": tagHue(tag) } as React.CSSProperties}
            onClick={() => setTag("")}
          >
            #{tag} <X className="size-3" />
          </button>
        ) : null}
        <fieldset className="seg" aria-label="Document view">
          {(
            [
              ["list", List, "List"],
              ["table", Rows3, "Table"],
              ["grid", LayoutGrid, "Grid"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              type="button"
              key={id}
              className={view === id ? "on" : ""}
              aria-pressed={view === id}
              title={label}
              aria-label={label}
              onClick={() => setView(id)}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </fieldset>
        <Button className="cta" onClick={() => void handleCreateDocument()} disabled={creating}>
          <Plus className="size-4" /> {creating ? "Creating…" : "New document"}
        </Button>
      </header>
      {view === "table" ? (
        <table className="docs-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Path</th>
              <th>Tags</th>
              <th>Updated</th>
              <th>Words</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((doc) => (
              <tr key={doc.id} onClick={() => openRecord(doc as never)}>
                <td>
                  <b>{doc.name}</b>
                </td>
                <td>
                  <code className="dpath">{doc.path}</code>
                </td>
                <td>
                  {doc.tags.map((name) => (
                    <span
                      key={name}
                      className="dchip tag"
                      style={{ "--h": tagHue(name) } as React.CSSProperties}
                    >
                      #{name}
                    </span>
                  ))}
                </td>
                <td>{formattedDate(doc.modifiedAt)}</td>
                <td>
                  {words[doc.id] === undefined ? (
                    <span className="dchip shimmer" aria-hidden="true" />
                  ) : (
                    words[doc.id]
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className={view === "grid" ? "docs-grid" : "docs-list"}>
          {visible.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => openRecord(doc as never)}
              className="drow"
            >
              <DocIcon />
              <span className="dtext">
                <b>{doc.name}</b>
                <span className="dline">
                  <code className="dpath">{doc.path}</code>
                  {chips(doc)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {visible.length === 0 && <p className="sub docs-empty">No documents match.</p>}
    </div>
  );
}
