"use client";

import { Button } from "@task/ui";
import { resolveLink } from "@task/workspace/links/resolve";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DocumentEditorSheet } from "@/components/document-editor-sheet";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { MarkdownBody } from "@/components/markdown-body";
import { detailRows } from "@/lib/document-details";
import { restartSectionEntrance } from "@/lib/entrance";
import { buildLinkContext, internalHref } from "@/lib/link-context";
import { extractLinks, headingEntries, toggleMarkdownCheckbox } from "@/lib/markdown";

type LinkedSearchResult = { id: string };

function wordCount(body: string): number {
  return (body.match(/\S+/g) ?? []).length;
}

function formattedDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(timestamp),
  );
}

export function DocumentReaderPage() {
  const {
    activeSelected,
    detail,
    workspace,
    records,
    openRecord,
    saveBody,
    deleteRecord,
    setNotice,
    documentDraft: draft,
    setDocumentDraft: setDraft,
    setEditingDocument: setEditing,
    documentConflict,
    resolveDocumentConflict,
  } = useWorkspaceApp();
  const router = useRouter();
  const [showDiff, setShowDiff] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Restart the entrance when the document view changes.
  useEffect(() => {
    restartSectionEntrance(document.querySelector<HTMLElement>(".body"));
  }, [editorOpen]);
  useEffect(() => {
    let active = true;
    setLinkedIds([]);
    if (!activeSelected?.id)
      return () => {
        active = false;
      };
    void fetch(
      `/api/runtime/workspace/search?q=${encodeURIComponent(`[[${activeSelected.id}]]`)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const payload = (await response.json()) as { results?: LinkedSearchResult[] };
        if (active && response.ok) setLinkedIds((payload.results ?? []).map((item) => item.id));
      })
      .catch(() => {
        if (active) setLinkedIds([]);
      });
    return () => {
      active = false;
    };
  }, [activeSelected?.id]);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const bodyText = detail?.body ?? "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: Follow the reading position of the open document.
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".body");
    const ids = headingEntries(bodyText)
      .filter((heading) => heading.level > 1 && heading.level < 4)
      .map((heading) => heading.id);
    if (!root || ids.length === 0) return;
    const update = () => {
      const top = root.getBoundingClientRect().top + 90;
      let current: string | null = ids[0] ?? null;
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= top) current = id;
      }
      setActiveHeading(current);
    };
    update();
    root.addEventListener("scroll", update, { passive: true });
    return () => root.removeEventListener("scroll", update);
  }, [bodyText, activeSelected?.id]);
  function goToHeading(id: string) {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    setActiveHeading(id);
    window.history.replaceState(null, "", `#${id}`);
  }
  if (!activeSelected || !detail)
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading Markdown…</p>
      </div>
    );
  const documentId = activeSelected.id;
  const linkContext = buildLinkContext(workspace, records, activeSelected.path);
  async function autosave(): Promise<boolean> {
    return saveBody(draft, "");
  }
  async function toggle(index: number, checked: boolean) {
    if (!detail) return;
    const current = detail;
    const next = toggleMarkdownCheckbox(current.body, index, checked);
    if (next !== current.body) await saveBody(next);
  }
  const dirty = draft !== detail.body;
  const headings = headingEntries(detail.body).filter(
    (heading) => heading.level > 1 && heading.level < 4,
  );
  const sources = extractLinks(detail.body)
    .map((link) => ({ link, target: resolveLink(link.href, linkContext) }))
    .filter((entry) => entry.target.kind !== "blocked" && entry.target.kind !== "anchor");
  const details = detailRows(activeSelected);
  const linkedRecords = linkedIds
    .map((id) => records.find((record) => record.id === id))
    .filter((record): record is NonNullable<typeof record> =>
      Boolean(record && record.id !== documentId),
    );
  function openEditor() {
    setEditing(true);
    setEditorOpen(true);
  }
  function closeEditor() {
    setEditorOpen(false);
    setEditing(false);
  }
  const conflictBanner = documentConflict && (
    <section className="document-conflict" role="alert">
      <div>
        <strong>This document changed on disk while you were editing.</strong>
        <p>
          Reload the new version, keep your draft against the latest file, or compare both versions.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            resolveDocumentConflict("reload");
            setShowDiff(false);
          }}
        >
          Reload
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            resolveDocumentConflict("keep");
            setShowDiff(false);
          }}
        >
          Keep mine
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowDiff((value) => !value)}>
          {showDiff ? "Hide diff" : "View diff"}
        </Button>
      </div>
      {showDiff && (
        <div className="document-diff">
          <section>
            <b>Your draft</b>
            <pre>{draft}</pre>
          </section>
          <section>
            <b>File on disk</b>
            <pre>{documentConflict.body}</pre>
          </section>
        </div>
      )}
    </section>
  );
  return (
    <article className="doc-reader-match">
      <header className="dh2">
        <Button asChild variant="ghost" size="sm" className="btn2">
          <Link href="/documents">
            <ArrowLeft className="size-4" />
            Documents
          </Link>
        </Button>
        <small className="sub min-w-0 truncate">{activeSelected.path}</small>
        <span className="gap" />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {dirty && <span className="pill document-dirty">Unsaved</span>}
          <Button
            variant="outline"
            size="sm"
            aria-label="Delete document"
            onClick={() =>
              void deleteRecord({ id: documentId, name: activeSelected.name }, "document").then(
                (deleted) => {
                  if (deleted) router.push("/documents");
                },
              )
            }
          >
            <Trash2 className="size-4" /> Delete
          </Button>
          <Button size="sm" onClick={openEditor}>
            <Pencil className="size-4" /> Edit
          </Button>
        </div>
      </header>
      {!editorOpen && conflictBanner}
      <h1 className="document-title">{activeSelected.name}</h1>
      <div className="document-meta dh2">
        <span className="pill">{activeSelected.type}</span>
        {activeSelected.tags.map((tag) => (
          <span className="tag" key={tag}>
            #{tag}
          </span>
        ))}
        <small className="sub">
          Updated {formattedDate(activeSelected.modifiedAt)} · {wordCount(draft)}
          words · {Math.max(1, Math.round(wordCount(draft) / 200))} min read
        </small>
      </div>
      <div className="edwrap">
        {
          <div className="dwrap">
            <div className="document-content">
              <MarkdownBody
                body={detail.body}
                className="mdb"
                headingAnchors
                linkContext={linkContext}
                onNavigate={(href) => router.push(href)}
                knownWikiLinks={records.map((record) => record.id)}
                onWikiLink={(id) => {
                  const record = records.find((item) => item.id === id);
                  if (record) openRecord(record);
                  else setNotice(`No file named ${id}`);
                }}
                onToggleTask={(index, checked) => void toggle(index, checked)}
                taskUpdatesDisabled={editorOpen}
              />
            </div>
            <aside className="toc">
              {headings.length > 0 && <h4>On this page</h4>}
              {headings.map((heading) => (
                <a
                  className={`${heading.level === 3 ? "l3" : ""} ${activeHeading === heading.id ? "on" : ""}`.trim()}
                  href={`#${heading.id}`}
                  aria-current={activeHeading === heading.id ? "location" : undefined}
                  key={heading.id}
                  onClick={(event) => {
                    event.preventDefault();
                    goToHeading(heading.id);
                  }}
                >
                  {heading.title}
                </a>
              ))}
              {sources.length > 0 && <h4>Sources</h4>}
              {sources.map(({ link, target }) =>
                target.kind === "external" ? (
                  <a
                    className="toc-link source"
                    key={link.href}
                    href={target.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={target.href}
                  >
                    {link.label}
                    <small>{new URL(target.href).host || target.href}</small>
                  </a>
                ) : (
                  <button
                    className="toc-link source"
                    key={link.href}
                    type="button"
                    title={link.href}
                    onClick={() => {
                      const internal = internalHref(target);
                      if (internal) router.push(internal);
                    }}
                  >
                    {link.label}
                    <small>{target.kind === "file" ? target.path : "Document"}</small>
                  </button>
                ),
              )}
              <h4>Linked from</h4>
              {linkedRecords.length > 0 ? (
                linkedRecords.map((record) => (
                  <button
                    className="toc-link"
                    key={record.id}
                    type="button"
                    onClick={() => openRecord(record)}
                  >
                    {record.type === "task" ? `${record.id} · ${record.name}` : record.name}
                    <small>
                      {record.type}
                      {record.status ? ` · ${record.status}` : ""}
                    </small>
                  </button>
                ))
              ) : (
                <small className="sub toc-empty">Nothing links here yet.</small>
              )}
              <h4>Details</h4>
              <dl className="toc-details">
                {details.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>
                      {row.values ? (
                        <span className="toc-chips">
                          {row.values.map((value) => (
                            <span key={value}>{value}</span>
                          ))}
                        </span>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        }
      </div>
      {editorOpen && (
        <DocumentEditorSheet
          title={activeSelected.name}
          path={activeSelected.path}
          value={draft}
          savedValue={detail.body}
          onChange={setDraft}
          onSave={autosave}
          onError={setNotice}
          banner={conflictBanner}
          onClose={closeEditor}
          preview={
            <MarkdownBody
              body={draft}
              className="mdb"
              headingAnchors
              linkContext={linkContext}
              onNavigate={(href) => router.push(href)}
              knownWikiLinks={records.map((record) => record.id)}
              onWikiLink={(id) => {
                const record = records.find((item) => item.id === id);
                if (record) openRecord(record);
                else setNotice(`No file named ${id}`);
              }}
            />
          }
        />
      )}
    </article>
  );
}
