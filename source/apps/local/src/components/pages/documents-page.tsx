"use client";

import { Button } from "@task/ui";
import { ChevronRight, Folder, LayoutGrid, List, Plus, Rows3, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { CustomSelect } from "@/components/ui/select";
import { directChildFolders, parentDocumentFolder } from "@/lib/markdown";
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

function TagChips({
  tags,
  activeTag,
  onTag,
}: {
  tags: readonly string[];
  activeTag: string;
  onTag(tag: string): void;
}) {
  const visible = tags.slice(0, 2);
  const hidden = tags.slice(2);
  return (
    <span className="doc-tag-list">
      {visible.map((name) => (
        <button
          type="button"
          key={name}
          className={`dchip tag ${activeTag === name ? "on" : ""}`}
          title={`Filter by #${name}`}
          onClick={(event) => {
            event.stopPropagation();
            onTag(name);
          }}
        >
          #{name}
        </button>
      ))}
      {hidden.length > 0 && (
        <details className="doc-tag-more">
          <summary>+{hidden.length} more</summary>
          <span className="doc-tag-menu">
            {hidden.map((name) => (
              <button
                type="button"
                key={name}
                className={`dchip tag ${activeTag === name ? "on" : ""}`}
                onClick={() => onTag(name)}
              >
                #{name}
              </button>
            ))}
          </span>
        </details>
      )}
    </span>
  );
}

export function DocumentsPage() {
  const router = useRouter();
  const {
    docs,
    documentFolder,
    openRecord,
    createDocument: createWorkspaceDocument,
  } = useWorkspaceApp();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [groupBy, setGroupBy] = usePersistentState<"none" | "folder" | "type">(
    "documents:group-by",
    "none",
    (value): value is "none" | "folder" | "type" =>
      value === "none" || value === "folder" || value === "type",
  );
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
    if (documentFolder && parentDocumentFolder(doc.path) !== documentFolder) return false;
    if (tag && !doc.tags.includes(tag)) return false;
    if (!normalizedQuery) return true;
    const metadata = `${doc.name} ${doc.path} ${doc.tags.join(" ")}`.toLocaleLowerCase();
    return (
      metadata.includes(normalizedQuery) ||
      (bodySearch?.query === normalizedQuery && bodySearch.ids.has(doc.id))
    );
  });
  const childFolders = directChildFolders(
    docs.filter((doc) => !tag || doc.tags.includes(tag)).map((doc) => doc.path),
    documentFolder,
  );
  const navigateFolder = (path: string) => {
    router.push(
      path ? `/documents/${path.split("/").map(encodeURIComponent).join("/")}` : "/documents",
    );
  };
  const folderPath = documentFolder ? documentFolder.split("/") : [];
  const groupedVisible =
    groupBy === "none"
      ? [{ label: "", documents: visible }]
      : [
          ...new Set(
            visible.map((doc) =>
              groupBy === "folder" ? parentDocumentFolder(doc.path) || "Root" : doc.type,
            ),
          ),
        ]
          .sort((left, right) => left.localeCompare(right))
          .map((label) => ({
            label,
            documents: visible.filter(
              (doc) =>
                (groupBy === "folder" ? parentDocumentFolder(doc.path) || "Root" : doc.type) ===
                label,
            ),
          }));

  const chips = (doc: Row) => {
    const count = words[doc.id];
    return (
      <span className="dchips">
        <Chip className="type doc-card-meta">{doc.type}</Chip>
        <TagChips
          tags={doc.tags}
          activeTag={tag}
          onTag={(name) => setTag(tag === name ? "" : name)}
        />
        <Chip className="doc-card-meta">{formattedDate(doc.modifiedAt)}</Chip>
        {count === undefined ? (
          <span className="dchip shimmer doc-card-meta" aria-hidden="true" />
        ) : (
          <Chip className="doc-card-meta">{count} words</Chip>
        )}
      </span>
    );
  };

  return (
    <div className="documents-match docs2">
      <header className="docs-bar">
        <div className="docs-heading">
          <h1>
            {documentFolder ? folderPath.at(-1) : "Documents"}{" "}
            <small>
              {visible.length} files · {childFolders.length} folders
            </small>
          </h1>
          <nav className="docs-breadcrumb" aria-label="Document path">
            <button type="button" onClick={() => navigateFolder("")}>
              Documents
            </button>
            {folderPath.map((part, index) => {
              const path = folderPath.slice(0, index + 1).join("/");
              return (
                <span key={path}>
                  <ChevronRight aria-hidden="true" />
                  <button type="button" onClick={() => navigateFolder(path)}>
                    {part}
                  </button>
                </span>
              );
            })}
          </nav>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles, tags and content…"
          aria-label="Search documents"
          className="docs-search"
        />
        {tag ? (
          <button type="button" className="dchip tag on" onClick={() => setTag("")}>
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
        <CustomSelect
          label="Group documents by"
          value={groupBy}
          onValueChange={(value) => setGroupBy(value as "none" | "folder" | "type")}
          options={[
            { value: "none", label: "Group: none" },
            { value: "folder", label: "Group: folder" },
            { value: "type", label: "Group: type" },
          ]}
        />
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
            {childFolders.map((folder) => (
              <tr key={`folder:${folder.path}`} onClick={() => navigateFolder(folder.path)}>
                <td>
                  <b>
                    <Folder className="docs-table-folder-icon" aria-hidden="true" />
                    {folder.name}/
                  </b>
                </td>
                <td>
                  <code className="dpath">{folder.path}/</code>
                </td>
                <td>Folder</td>
                <td>—</td>
                <td>{folder.count} files</td>
              </tr>
            ))}
            {visible.map((doc) => (
              <tr key={doc.id} onClick={() => openRecord(doc as never)}>
                <td>
                  <b>{doc.name}</b>
                </td>
                <td>
                  <code className="dpath">{doc.path}</code>
                </td>
                <td>
                  <TagChips
                    tags={doc.tags}
                    activeTag={tag}
                    onTag={(name) => setTag(tag === name ? "" : name)}
                  />
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
          {childFolders.map((folder) => (
            <button
              key={folder.path}
              type="button"
              className="drow folder-row"
              onClick={() => navigateFolder(folder.path)}
            >
              <Folder className="docs-folder-icon" aria-hidden="true" />
              <span className="dtext">
                <b>{folder.name}</b>
                <span className="dline">
                  <span className="dpath">{folder.path}/</span>
                  <Chip>{folder.count} files</Chip>
                </span>
              </span>
              <ChevronRight className="docs-folder-next" aria-hidden="true" />
            </button>
          ))}
          {groupedVisible.map((group) => (
            <Fragment key={group.label || "all"}>
              {group.label && (
                <h2 className="docs-group-title">
                  {groupBy === "folder" && group.label !== "Root" ? (
                    <button
                      type="button"
                      onClick={() => navigateFolder(group.label)}
                      title={`Open ${group.label}/`}
                    >
                      <Folder aria-hidden="true" />
                      {group.label}/
                    </button>
                  ) : (
                    group.label
                  )}
                </h2>
              )}
              {group.documents.map((doc) => (
                <div key={doc.id} className="drow">
                  <DocIcon />
                  <span className="dtext">
                    <button
                      type="button"
                      className="dopen"
                      onClick={() => openRecord(doc as never)}
                    >
                      <b>{doc.name}</b>
                    </button>
                    <span className="dline">
                      <code className="dpath">{doc.path}</code>
                      {chips(doc)}
                    </span>
                  </span>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      )}
      {visible.length === 0 && childFolders.length === 0 && (
        <p className="sub docs-empty">No documents or folders match.</p>
      )}
    </div>
  );
}
