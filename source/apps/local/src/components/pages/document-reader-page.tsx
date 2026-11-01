"use client";

import { Button } from "@task/ui";
import { ArrowLeft, RotateCcw, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { MarkdownBody } from "@/components/markdown-body";
import { MarkdownEditor } from "@/components/markdown-editor";
import { restartSectionEntrance } from "@/lib/entrance";
import { buildLinkContext } from "@/lib/link-context";
import { toggleMarkdownCheckbox } from "@/lib/markdown";

type HeadingEntry = { level: number; title: string; id: string };
type LinkedSearchResult = { id: string };

function documentHeadings(markdown: string): HeadingEntry[] {
  const occurrences = new Map<string, number>();
  let inCodeFence = false;
  return markdown.split("\n").flatMap((line) => {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      return [];
    }
    if (inCodeFence) return [];
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) return [];
    const level = match[1].length;
    const title = match[2]
      .replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`*_~]/g, "")
      .trim();
    const slug = `h-${title
      .toLocaleLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-|-$/g, "")}`;
    const occurrence = occurrences.get(slug) ?? 0;
    occurrences.set(slug, occurrence + 1);
    return level === 2 || level === 3
      ? [{ level, title, id: occurrence ? `${slug}-${occurrence + 1}` : slug }]
      : [];
  });
}

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
  const [saving, setSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [mode, setMode] = useState<"read" | "edit" | "split">("read");
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Restart the entrance when the document view changes.
  useEffect(() => {
    restartSectionEntrance(document.querySelector<HTMLElement>(".body"));
  }, [mode]);
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
  if (!activeSelected || !detail)
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading Markdown…</p>
      </div>
    );
  const documentId = activeSelected.id;
  async function save() {
    setSaving(true);
    try {
      if (await saveBody(draft)) setEditing(false);
    } finally {
      setSaving(false);
    }
  }
  async function toggle(index: number, checked: boolean) {
    if (!detail) return;
    const current = detail;
    const next = toggleMarkdownCheckbox(current.body, index, checked);
    if (next !== current.body) await saveBody(next);
  }
  const dirty = draft !== detail.body;
  const headings = documentHeadings(detail.body).filter(
    (heading) => heading.level > 1 && heading.level < 4,
  );
  const linkedRecords = linkedIds
    .map((id) => records.find((record) => record.id === id))
    .filter((record): record is NonNullable<typeof record> =>
      Boolean(record && record.id !== documentId),
    );
  function changeMode(nextMode: "read" | "edit" | "split") {
    setMode(nextMode);
    setEditing(nextMode !== "read" || dirty);
  }
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
          {mode !== "read" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={!dirty}
                onClick={() => {
                  setDraft(detail.body);
                  setEditing(false);
                }}
              >
                <RotateCcw className="size-4" /> Revert
              </Button>
              <Button size="sm" disabled={saving || !dirty} onClick={() => void save()}>
                <Save className="size-4" /> {saving ? "Saving…" : "Save"}
              </Button>
            </>
          )}
          <fieldset className="seg" aria-label="Document view">
            {(["read", "edit", "split"] as const).map((view) => (
              <button
                type="button"
                key={view}
                className={mode === view ? "on" : ""}
                onClick={() => changeMode(view)}
              >
                {view === "read" ? "Read" : view === "edit" ? "Edit" : "Split"}
              </button>
            ))}
          </fieldset>
        </div>
      </header>
      {documentConflict && (
        <section className="document-conflict" role="alert">
          <div>
            <strong>This document changed on disk while you were editing.</strong>
            <p>
              Reload the new version, keep your draft against the latest file, or compare both
              versions.
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
      )}
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
      <div className={`edwrap ${mode === "split" ? "split" : ""}`}>
        {mode !== "read" && (
          <MarkdownEditor
            key={`${activeSelected.id}:${detail.contentHash}`}
            value={draft}
            onError={setNotice}
            onChange={(body) => {
              setDraft(body);
              setEditing(body !== detail.body);
            }}
          />
        )}
        {mode === "read" ? (
          <div className="dwrap">
            <div className="document-content">
              <MarkdownBody
                body={detail.body}
                className="mdb"
                headingAnchors
                linkContext={buildLinkContext(workspace, records, activeSelected.path)}
                onNavigate={(href) => router.push(href)}
                knownWikiLinks={records.map((record) => record.id)}
                onWikiLink={(id) => {
                  const record = records.find((item) => item.id === id);
                  if (record) openRecord(record);
                  else setNotice(`No file named ${id}`);
                }}
                onToggleTask={(index, checked) => void toggle(index, checked)}
                taskUpdatesDisabled={saving}
              />
            </div>
            <aside className="toc">
              {headings.length > 0 && <h4>On this page</h4>}
              {headings.map((heading) => (
                <a
                  className={heading.level === 3 ? "l3" : ""}
                  href={`#${heading.id}`}
                  key={heading.id}
                >
                  {heading.title}
                </a>
              ))}
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
                  </button>
                ))
              ) : (
                <small className="sub toc-empty">Nothing links here yet.</small>
              )}
            </aside>
          </div>
        ) : (
          <>
            {mode === "split" && (
              <div className="document-preview mdb">
                <MarkdownBody
                  body={draft}
                  className="mdb"
                  headingAnchors
                  linkContext={buildLinkContext(workspace, records, activeSelected.path)}
                  onNavigate={(href) => router.push(href)}
                  knownWikiLinks={records.map((record) => record.id)}
                  onWikiLink={(id) => {
                    const record = records.find((item) => item.id === id);
                    if (record) openRecord(record);
                    else setNotice(`No file named ${id}`);
                  }}
                />
              </div>
            )}
            {mode === "edit" && headings.length > 0 && (
              <div className="sr-only" aria-live="polite">
                {headings.length} document sections
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
