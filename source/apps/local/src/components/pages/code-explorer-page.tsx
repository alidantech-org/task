"use client";

import {
  ChevronDown,
  ChevronRight,
  Code2,
  Eye,
  FileCode2,
  FileDiff,
  Folder,
  FolderOpen,
  Maximize2,
  Minimize2,
  Minus,
  Pencil,
  Plus,
  GitBranch,
  Search,
  WrapText,
  Map as Minimap,
  Save,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { CustomSelect } from "@/components/ui/select";
import { usePersistentState } from "@/lib/persistent-state";
import type { ProjectSearchHit, ProjectTree } from "@task/workspace/files/tree";

const CodeEditorPane = dynamic(
  () => import("@/components/code-editor-pane").then((module) => module.CodeEditorPane),
  {
    ssr: false,
    loading: () => <div className="code-editor-loading">Starting local code editor…</div>,
  },
);

type ProjectFile = {
  path: string;
  size: number;
  language: string;
  binary: boolean;
  contentHash: string;
  content: string;
};
type TreePayload = { tree?: ProjectTree; error?: { message?: string } };
type FilePayload = { file?: ProjectFile; error?: { message?: string } };
type SearchPayload = { results?: ProjectSearchHit[]; error?: { message?: string } };
type DiffPayload = { original?: string; error?: { message?: string } };
type EditorThemeMode = "system" | "light" | "dark";
function isEditorThemeMode(value: unknown): value is EditorThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function parentOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

function globPattern(value: string): RegExp | null {
  if (!value.includes("*") && !value.includes("?")) return null;
  const escaped = value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i");
}

function CodeExplorer() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedPath = params.get("path") ?? "";
  const folderTarget = params.get("folder") ?? "";
  const searchQuery = params.get("q") ?? "";
  const lineNumber = Number(params.get("L") ?? "0");
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [treeError, setTreeError] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [file, setFile] = useState<ProjectFile | null>(null);
  const [original, setOriginal] = useState("");
  const [searchHits, setSearchHits] = useState<ProjectSearchHit[]>([]);
  const [searchComplete, setSearchComplete] = useState(false);
  const [contentError, setContentError] = useState("");
  const [mode, setMode] = useState<"file" | "diff">("file");
  const [sideMode, setSideMode] = useState<"explorer" | "changes">("explorer");
  const [editable, setEditable] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [diffLayout, setDiffLayout] = useState<"inline" | "side-by-side">("side-by-side");
  const [wordWrap, setWordWrap] = useState(false);
  const [minimap, setMinimap] = useState(true);
  const [fontSize, setFontSize] = useState(13);
  const [findTrigger, setFindTrigger] = useState(0);
  const [themeMode, setThemeMode] = usePersistentState<EditorThemeMode>(
    "task:code-editor-theme",
    "system",
    isEditorThemeMode,
  );
  const dirty = Boolean(file && editable && draft !== file.content);

  const discardDraft = useCallback(() => {
    setDraft(file?.content ?? "");
    setEditable(false);
    setContentError("");
  }, [file]);

  useEffect(() => {
    let active = true;
    void fetch("/api/runtime/workspace/project-tree", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as TreePayload;
        if (!active) return;
        if (response.ok && payload.tree) setTree(payload.tree);
        else setTreeError(payload.error?.message ?? "Could not read the project tree");
      })
      .catch(() => active && setTreeError("Could not reach the local runtime"));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!folderTarget || !tree) return;
    const next = new Set<string>();
    let current = "";
    for (const part of folderTarget.split("/")) {
      current = current ? `${current}/${part}` : part;
      next.add(current);
    }
    setExpanded((previous) => new Set([...previous, ...next]));
  }, [folderTarget, tree]);

  useEffect(() => {
    let active = true;
    setFile(null);
    setOriginal("");
    setContentError("");
    if (!selectedPath)
      return () => {
        active = false;
      };
    void Promise.all([
      fetch(`/api/runtime/workspace/project-file?path=${encodeURIComponent(selectedPath)}`, {
        cache: "no-store",
      }),
      fetch(`/api/runtime/workspace/project-diff?path=${encodeURIComponent(selectedPath)}`, {
        cache: "no-store",
      }),
    ])
      .then(async ([fileResponse, diffResponse]) => {
        const [filePayload, diffPayload] = (await Promise.all([
          fileResponse.json(),
          diffResponse.json(),
        ])) as [FilePayload, DiffPayload];
        if (!active) return;
        const selected = tree?.files.find((entry) => entry.path === selectedPath);
        if (fileResponse.ok && filePayload.file) setFile(filePayload.file);
        else if (selected?.status === "deleted")
          setFile({
            path: selected.path,
            size: 0,
            language: selected.language,
            binary: false,
            contentHash: "",
            content: "",
          });
        else setContentError(filePayload.error?.message ?? "This path is missing from the project");
        if (diffResponse.ok) {
          setOriginal(diffPayload.original ?? "");
        }
      })
      .catch(() => active && setContentError("Could not reach the local runtime"));
    return () => {
      active = false;
    };
  }, [selectedPath, tree]);

  useEffect(() => {
    if (!file) return;
    setDraft(file.content);
    setEditable(false);
  }, [file]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveFile();
      } else if (event.key === "Escape" && editable) {
        event.preventDefault();
        if (dirty && !window.confirm("Discard your unsaved code changes?")) return;
        discardDraft();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", onKeyDown);
    const guardNavigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest(".code-explorer")) return;
      if (!target.closest(".nv, a[href]")) return;
      if (!window.confirm("Discard your unsaved code changes and leave this file?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener("click", guardNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", guardNavigation, true);
    };
  }, [dirty, editable, discardDraft]);

  useEffect(() => {
    let active = true;
    setSearchHits([]);
    setSearchComplete(false);
    if (!searchQuery)
      return () => {
        active = false;
      };
    void fetch(`/api/runtime/workspace/project-search?q=${encodeURIComponent(searchQuery)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as SearchPayload;
        if (active && response.ok) setSearchHits(payload.results ?? []);
        if (active) setSearchComplete(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [searchQuery]);

  const filteredFiles = useMemo(() => {
    const files = tree?.files ?? [];
    const query = pathFilter.trim();
    if (!query) return files;
    const pattern = globPattern(query);
    return files.filter((entry) =>
      pattern
        ? pattern.test(entry.path)
        : entry.path.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    );
  }, [tree, pathFilter]);
  const filterExpanded = useMemo(() => {
    if (!pathFilter.trim()) return new Set<string>();
    const folders = new Set<string>();
    for (const entry of filteredFiles) {
      let parent = parentOf(entry.path);
      while (parent) {
        folders.add(parent);
        parent = parentOf(parent);
      }
    }
    return folders;
  }, [filteredFiles, pathFilter]);
  const filesByParent = useMemo(() => {
    const map = new Map<string, NonNullable<ProjectTree["files"]>>();
    for (const fileEntry of tree?.files ?? []) {
      const parent = parentOf(fileEntry.path);
      map.set(parent, [...(map.get(parent) ?? []), fileEntry]);
    }
    return map;
  }, [tree]);
  const foldersByParent = useMemo(() => {
    const map = new Map<string, NonNullable<ProjectTree["folders"]>>();
    for (const folder of tree?.folders ?? []) {
      const parent = parentOf(folder.path);
      map.set(parent, [...(map.get(parent) ?? []), folder]);
    }
    return map;
  }, [tree]);

  const openFile = useCallback(
    (path: string) => {
      if (dirty && !window.confirm("Discard your unsaved code changes?")) return;
      router.push(`/code?path=${encodeURIComponent(path)}`);
    },
    [dirty, router],
  );

  async function saveFile(): Promise<void> {
    if (!file || !dirty || saving) return;
    setSaving(true);
    setContentError("");
    try {
      const response = await fetch("/api/runtime/workspace/project-file", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: file.path, content: draft, expectedHash: file.contentHash }),
      });
      const payload = (await response.json()) as FilePayload;
      if (!response.ok || !payload.file)
        throw new Error(payload.error?.message ?? "Could not save this file");
      setFile(payload.file);
      setDraft(payload.file.content);
      setEditable(false);
      const treeResponse = await fetch("/api/runtime/workspace/project-tree", {
        cache: "no-store",
      });
      const treePayload = (await treeResponse.json()) as TreePayload;
      if (treeResponse.ok && treePayload.tree) setTree(treePayload.tree);
    } catch (error) {
      setContentError(error instanceof Error ? error.message : "Could not save this file");
    } finally {
      setSaving(false);
    }
  }

  async function reloadFile(): Promise<void> {
    if (!selectedPath) return;
    const response = await fetch(
      `/api/runtime/workspace/project-file?path=${encodeURIComponent(selectedPath)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as FilePayload;
    if (!response.ok || !payload.file) {
      setContentError(payload.error?.message ?? "Could not reload this file");
      return;
    }
    setFile(payload.file);
    setDraft(payload.file.content);
    setContentError("");
    setEditable(true);
  }

  function renderFolder(folderPath: string, depth: number): React.ReactNode {
    const folder = tree?.folders.find((entry) => entry.path === folderPath);
    if (!folder) return null;
    const open = expanded.has(folderPath) || filterExpanded.has(folderPath);
    const visibleFolders = (foldersByParent.get(folderPath) ?? []).filter(
      (child) =>
        !pathFilter || filteredFiles.some((entry) => entry.path.startsWith(`${child.path}/`)),
    );
    const visibleFiles = (filesByParent.get(folderPath) ?? []).filter(
      (entry) => !pathFilter || filteredFiles.some((match) => match.path === entry.path),
    );
    if (pathFilter && visibleFolders.length === 0 && visibleFiles.length === 0) return null;
    return (
      <div key={folderPath}>
        <button
          type="button"
          className="code-tree-row code-tree-folder"
          style={{ paddingInlineStart: `${10 + depth * 14}px` }}
          aria-expanded={open}
          onClick={() =>
            setExpanded((current) => {
              const next = new Set(current);
              if (next.has(folderPath)) next.delete(folderPath);
              else next.add(folderPath);
              return next;
            })
          }
        >
          {open ? <ChevronDown /> : <ChevronRight />}
          {open ? <FolderOpen /> : <Folder />}
          <span>{folder.name}</span>
        </button>
        {open && (
          <div>
            {visibleFolders.map((child) => renderFolder(child.path, depth + 1))}
            {visibleFiles.map((entry) => renderFile(entry, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  function renderFile(
    entry: NonNullable<ProjectTree["files"]>[number],
    depth: number,
  ): React.ReactNode {
    return (
      <button
        type="button"
        key={entry.path}
        className={`code-tree-row code-tree-file ${selectedPath === entry.path ? "is-selected" : ""}`}
        style={{ paddingInlineStart: `${10 + depth * 14}px` }}
        title={entry.path}
        onClick={() => openFile(entry.path)}
      >
        <FileCode2 />
        <span>{entry.name}</span>
        {entry.status && <i className={`code-status s-${entry.status}`} title={entry.status} />}
      </button>
    );
  }

  const rootFolders = (foldersByParent.get("") ?? []).filter(
    (folder) =>
      !pathFilter || filteredFiles.some((entry) => entry.path.startsWith(`${folder.path}/`)),
  );
  const rootFiles = (filesByParent.get("") ?? []).filter(
    (entry) => !pathFilter || filteredFiles.some((match) => match.path === entry.path),
  );
  const selectedEntry = tree?.files.find((entry) => entry.path === selectedPath);
  const changedFiles = tree?.files.filter((entry) => entry.status) ?? [];
  const folderMissing = Boolean(
    folderTarget && tree && !tree.folders.some((entry) => entry.path === folderTarget),
  );

  return (
    <section className={`code-explorer ${fullscreen ? "is-fullscreen" : ""}`}>
      <header className="code-explorer-header">
        <div>
          <p className="sub">Browse source files and local Git changes.</p>
          <h1>
            <Code2 aria-hidden="true" /> Code
          </h1>
        </div>
        <div className="code-explorer-git">
          <GitBranch aria-hidden="true" />{" "}
          {tree?.gitRoot ? `${changedFiles.length} changed` : "Not a Git repository"}
        </div>
      </header>
      <div className="code-explorer-workspace">
        <aside className="code-explorer-sidebar" aria-label="Project files">
          <div className="code-sidebar-tabs" role="tablist" aria-label="Project navigation">
            <button
              type="button"
              role="tab"
              aria-selected={sideMode === "explorer"}
              className={sideMode === "explorer" ? "on" : ""}
              onClick={() => setSideMode("explorer")}
            >
              <Folder /> Explorer
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sideMode === "changes"}
              className={sideMode === "changes" ? "on" : ""}
              onClick={() => setSideMode("changes")}
            >
              <GitBranch /> Changes <i>{changedFiles.length}</i>
            </button>
          </div>
          {sideMode === "explorer" ? (
            <>
              <label className="code-path-search">
                <Search aria-hidden="true" />
                <input
                  value={pathFilter}
                  onChange={(event) => setPathFilter(event.target.value)}
                  placeholder="Find files · *.tsx"
                  aria-label="Find files by path or glob"
                />
              </label>
              {searchQuery && (
                <section className="code-search-results">
                  <h2>
                    Code search · <code>{searchQuery}</code>
                  </h2>
                  {searchHits.length ? (
                    searchHits.map((hit) => (
                      <button
                        type="button"
                        key={`${hit.path}:${hit.line}`}
                        onClick={() =>
                          router.push(`/code?path=${encodeURIComponent(hit.path)}&L=${hit.line}`)
                        }
                      >
                        <b>{hit.path}</b>
                        <small>
                          {hit.line}: {hit.text}
                        </small>
                      </button>
                    ))
                  ) : (
                    <p className="sub">
                      {searchComplete ? "No matches." : "Searching project files…"}
                    </p>
                  )}
                </section>
              )}
              <div className="code-tree">
                {treeError && (
                  <p role="alert" className="code-error">
                    {treeError}
                  </p>
                )}
                {!tree && !treeError && <p className="sub">Loading file tree…</p>}
                {folderMissing && (
                  <p role="alert" className="code-error">
                    Folder not found: {folderTarget}
                  </p>
                )}
                {rootFolders.map((folder) => renderFolder(folder.path, 0))}
                {rootFiles.map((entry) => renderFile(entry, 0))}
                {tree && filteredFiles.length === 0 && (
                  <p className="sub code-no-files">No matching files.</p>
                )}
              </div>
            </>
          ) : (
            <div className="code-change-list">
              {changedFiles.length ? (
                changedFiles.map((entry) => (
                  <button type="button" key={entry.path} onClick={() => openFile(entry.path)}>
                    <FileCode2 aria-hidden="true" />
                    <span>{entry.path}</span>
                    <small>{entry.status}</small>
                  </button>
                ))
              ) : (
                <p>
                  {tree?.gitRoot
                    ? "No changes in the working tree."
                    : "Git is not available for this project."}
                </p>
              )}
            </div>
          )}
        </aside>
        <main className="code-explorer-editor">
          {selectedPath ? (
            <>
              <nav className="code-file-breadcrumb" aria-label="File location">
                {selectedPath.split("/").map((segment, index, all) => (
                  <span key={`${index}-${segment}`}>
                    {segment}
                    {index < all.length - 1 ? <i>/</i> : null}
                  </span>
                ))}
              </nav>
              <div className="code-file-toolbar">
                <div>
                  <FileCode2 aria-hidden="true" />
                  <b title={selectedPath}>{selectedPath}</b>
                  <small className={editable ? "code-editing-state" : ""}>
                    {editable
                      ? dirty
                        ? "Unsaved changes"
                        : "Write mode"
                      : (selectedEntry?.status ?? "Read only")}
                  </small>
                </div>
                <div className="code-file-actions">
                  <div className="seg" role="group" aria-label="File display">
                    <button
                      type="button"
                      className={mode === "file" ? "on" : ""}
                      aria-pressed={mode === "file"}
                      onClick={() => setMode("file")}
                    >
                      <Code2 /> File
                    </button>
                    <button
                      type="button"
                      className={mode === "diff" ? "on" : ""}
                      aria-pressed={mode === "diff"}
                      onClick={() => {
                        if (dirty) {
                          setContentError(
                            "Save or discard your draft before opening the working-tree diff.",
                          );
                          return;
                        }
                        setMode("diff");
                        setEditable(false);
                      }}
                    >
                      <FileDiff /> Diff
                    </button>
                  </div>
                  {mode === "diff" && (
                    <div className="seg code-diff-layout" role="group" aria-label="Diff layout">
                      <button
                        type="button"
                        className={diffLayout === "side-by-side" ? "on" : ""}
                        aria-pressed={diffLayout === "side-by-side"}
                        onClick={() => setDiffLayout("side-by-side")}
                      >
                        Side by side
                      </button>
                      <button
                        type="button"
                        className={diffLayout === "inline" ? "on" : ""}
                        aria-pressed={diffLayout === "inline"}
                        onClick={() => setDiffLayout("inline")}
                      >
                        Inline
                      </button>
                    </div>
                  )}
                  {mode === "file" ? (
                    <div className="seg code-edit-mode" role="group" aria-label="Editor mode">
                      <button
                        type="button"
                        className={!editable ? "on" : ""}
                        aria-pressed={!editable}
                        onClick={() => {
                          if (dirty && !window.confirm("Discard your unsaved code changes?")) return;
                          if (dirty) setDraft(file?.content ?? "");
                          setEditable(false);
                          setContentError("");
                        }}
                      >
                        <Eye /> Read
                      </button>
                      <button
                        type="button"
                        className={editable ? "on" : ""}
                        aria-pressed={editable}
                        disabled={!file || file.binary || selectedEntry?.status === "deleted"}
                        onClick={() => {
                          setContentError("");
                          setEditable(true);
                        }}
                        title="Edit this project file"
                      >
                        <Pencil /> Write
                      </button>
                    </div>
                  ) : null}
                  {mode === "file" && editable ? (
                    <>
                      <button
                        type="button"
                        className="code-editor-tool code-save"
                        disabled={!dirty || saving}
                        onClick={() => void saveFile()}
                        title="Save file · Ctrl/Cmd+S"
                      >
                        <Save />
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="code-editor-tool"
                        disabled={saving}
                        onClick={discardDraft}
                        title="Discard unsaved changes"
                      >
                        <X />
                        Discard
                      </button>
                    </>
                  ) : null}
                  {mode === "file" && (
                    <>
                      <button
                        type="button"
                        className="code-editor-tool icon"
                        onClick={() => setFindTrigger((value) => value + 1)}
                        title="Find in file · Ctrl/Cmd+F"
                        aria-label="Find in file"
                      >
                        <Search />
                      </button>
                      <button
                        type="button"
                        className={`code-editor-tool icon code-secondary-tool ${wordWrap ? "on" : ""}`}
                        aria-pressed={wordWrap}
                        onClick={() => setWordWrap((value) => !value)}
                        title="Toggle word wrap"
                        aria-label="Toggle word wrap"
                      >
                        <WrapText />
                      </button>
                      <button
                        type="button"
                        className={`code-editor-tool icon code-secondary-tool ${minimap ? "on" : ""}`}
                        aria-pressed={minimap}
                        onClick={() => setMinimap((value) => !value)}
                        title="Toggle minimap"
                        aria-label="Toggle minimap"
                      >
                        <Minimap />
                      </button>
                      <div
                        className="code-font-size code-secondary-tool"
                        aria-label={`Editor font size ${fontSize}px`}
                      >
                        <button
                          type="button"
                          onClick={() => setFontSize((value) => Math.max(10, value - 1))}
                          disabled={fontSize <= 10}
                          title="Decrease editor text size"
                          aria-label="Decrease editor text size"
                        >
                          <Minus />
                        </button>
                        <span>{fontSize}</span>
                        <button
                          type="button"
                          onClick={() => setFontSize((value) => Math.min(20, value + 1))}
                          disabled={fontSize >= 20}
                          title="Increase editor text size"
                          aria-label="Increase editor text size"
                        >
                          <Plus />
                        </button>
                      </div>
                    </>
                  )}
                  <CustomSelect
                    label="Editor theme"
                    value={themeMode}
                    onValueChange={(value) => setThemeMode(value as EditorThemeMode)}
                    className="code-theme-select"
                    options={[
                      { value: "system", label: "System theme" },
                      { value: "light", label: "Light editor" },
                      { value: "dark", label: "Dark editor" },
                    ]}
                  />
                  <button
                    type="button"
                    className={`code-editor-tool icon ${fullscreen ? "on" : ""}`}
                    aria-pressed={fullscreen}
                    onClick={() => setFullscreen((value) => !value)}
                    title={fullscreen ? "Exit full screen · Esc" : "Full screen editor"}
                    aria-label={fullscreen ? "Exit full screen" : "Full screen editor"}
                  >
                    {fullscreen ? <Minimize2 /> : <Maximize2 />}
                  </button>
                </div>
              </div>
              {contentError ? (
                <div role="alert" className="code-error">
                  {contentError}
                  {dirty && (
                    <button type="button" onClick={() => void reloadFile()}>
                      Discard draft and reload
                    </button>
                  )}
                </div>
              ) : !file ? (
                <p className="sub">Loading file…</p>
              ) : file.binary ? (
                <p className="sub">Binary file · {file.size.toLocaleString()} bytes</p>
              ) : mode === "diff" && selectedEntry?.status ? (
                <div className="code-editor-canvas">
                  <CodeEditorPane
                    path={file.path}
                    language={file.language}
                    content={file.content}
                    original={original}
                    diff
                    diffLayout={diffLayout}
                    themeMode={themeMode}
                  />
                </div>
              ) : mode === "diff" ? (
                <p className="sub code-empty-diff">No tracked changes for this file.</p>
              ) : selectedEntry?.status === "deleted" ? (
                <div className="code-deleted-file">
                  <FileDiff />
                  <p>This file was deleted from the working tree.</p>
                  <button type="button" onClick={() => setMode("diff")}>
                    View deleted content and diff
                  </button>
                </div>
              ) : (
                <div className="code-editor-canvas">
                  <CodeEditorPane
                    path={file.path}
                    language={file.language}
                    content={draft}
                    line={lineNumber || undefined}
                    editable={editable}
                    onChange={setDraft}
                    findTrigger={findTrigger}
                    wordWrap={wordWrap}
                    minimap={minimap}
                    fontSize={fontSize}
                    themeMode={themeMode}
                  />
                </div>
              )}
            </>
          ) : folderTarget ? (
            <div className="code-empty-state">
              <FolderOpen />
              <h2>{folderTarget}</h2>
              <p>Browse the expanded folder in the file tree, or choose a file inside it.</p>
            </div>
          ) : (
            <div className="code-empty-state">
              <Code2 />
              <h2>Open a file</h2>
              <p>
                Choose a file from the tree, search paths with patterns like <code>*.tsx</code>, or
                click inline code in a document to search its usage.
              </p>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

export function CodeExplorerPage() {
  return (
    <Suspense fallback={<p className="sub">Loading code explorer…</p>}>
      <CodeExplorer />
    </Suspense>
  );
}
