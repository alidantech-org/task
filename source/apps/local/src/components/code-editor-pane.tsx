"use client";

import Editor, { DiffEditor, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useEffect, useRef, useState } from "react";

loader.config({ monaco });

type CodeEditorPaneProps = {
  path: string;
  language: string;
  content: string;
  original?: string;
  diff?: boolean;
  line?: number;
  editable?: boolean;
  onChange?(value: string): void;
  findTrigger?: number;
  wordWrap?: boolean;
  minimap?: boolean;
  fontSize?: number;
  diffLayout?: "inline" | "side-by-side";
  themeMode?: "system" | "light" | "dark";
};

const editorOptions = {
  automaticLayout: true,
  bracketPairColorization: { enabled: true },
  cursorBlinking: "smooth" as const,
  fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 13,
  guides: { indentation: true, bracketPairs: true },
  lineNumbers: "on" as const,
  minimap: { enabled: true, scale: 1, side: "right" as const },
  padding: { top: 12, bottom: 12 },
  readOnly: true,
  renderLineHighlight: "all" as const,
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  stickyScroll: { enabled: true },
  wordWrap: "off" as const,
};

export function CodeEditorPane({
  path,
  language,
  content,
  original = "",
  diff = false,
  line,
  editable = false,
  onChange,
  findTrigger = 0,
  wordWrap = false,
  minimap = true,
  fontSize = 13,
  diffLayout = "side-by-side",
  themeMode = "system",
}: CodeEditorPaneProps) {
  const [theme, setTheme] = useState("taskcode-dark");
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  useEffect(() => {
    const update = () => {
      const styles = getComputedStyle(document.documentElement);
      const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
      const light = themeMode === "light" || (themeMode === "system" && document.documentElement.dataset.theme === "light");
      const colors = light
        ? { panel: "#ffffff", ink: "#131a2b", muted: "#6b7488", line: "#e3e7ef", soft: "#f4f6fa", accent: "#4a63f5" }
        : { panel: "#151a26", ink: "#eef1f8", muted: "#8e98ae", line: "#252c3d", soft: "#202635", accent: "#7489ff" };
      const palette = {
        "editor.background": themeMode === "system" ? token("--pn", colors.panel) : colors.panel,
        "editor.foreground": themeMode === "system" ? token("--ink", colors.ink) : colors.ink,
        "editorLineNumber.foreground": themeMode === "system" ? token("--mut", colors.muted) : colors.muted,
        "editorLineNumber.activeForeground": themeMode === "system" ? token("--ink", colors.ink) : colors.ink,
        "editorGutter.background": themeMode === "system" ? token("--pn", colors.panel) : colors.panel,
        "editor.lineHighlightBackground": themeMode === "system" ? token("--soft", colors.soft) : colors.soft,
        "editorCursor.foreground": themeMode === "system" ? token("--acc", colors.accent) : colors.accent,
        "editorIndentGuide.background1": themeMode === "system" ? token("--ln", colors.line) : colors.line,
        "editorIndentGuide.activeBackground1": themeMode === "system" ? token("--acc", colors.accent) : colors.accent,
        "minimap.background": themeMode === "system" ? token("--pn", colors.panel) : colors.panel,
        "editorOverviewRuler.border": themeMode === "system" ? token("--ln", colors.line) : colors.line,
        "diffEditor.insertedTextBackground": light ? "#16a34a33" : "#22c55e38",
        "diffEditor.removedTextBackground": light ? "#dc262633" : "#ef444438",
        "diffEditor.insertedLineBackground": light ? "#16a34a16" : "#22c55e1b",
        "diffEditor.removedLineBackground": light ? "#dc262616" : "#ef44441b",
        "diffEditorGutter.insertedLineBackground": light ? "#16a34a55" : "#22c55e55",
        "diffEditorGutter.removedLineBackground": light ? "#dc262655" : "#ef444455",
      };
      monaco.editor.defineTheme("taskcode-light", { base: "vs", inherit: true, rules: [], colors: palette });
      monaco.editor.defineTheme("taskcode-dark", { base: "vs-dark", inherit: true, rules: [], colors: palette });
      setTheme(light ? "taskcode-light" : "taskcode-dark");
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [themeMode]);
  useEffect(() => {
    if (!findTrigger) return;
    const editor = diff ? diffEditorRef.current?.getModifiedEditor() : editorRef.current;
    void editor?.getAction("actions.find")?.run();
  }, [diff, findTrigger]);

  if (diff) {
    return (
      <DiffEditor
        height="100%"
        width="100%"
        original={original}
        modified={content}
        language={language}
        theme={theme}
        options={{
          automaticLayout: true,
          enableSplitViewResizing: true,
          ignoreTrimWhitespace: false,
          renderSideBySide: diffLayout === "side-by-side",
          minimap: { enabled: false },
          originalEditable: false,
          readOnly: true,
          scrollBeyondLastLine: false,
          wordWrap: "off",
        }}
        loading={<div className="code-editor-loading">Starting local code editor…</div>}
        onMount={(editor) => { diffEditorRef.current = editor; }}
      />
    );
  }

  return (
    <Editor
      height="100%"
      width="100%"
      path={`file:///${path}`}
      language={language}
      value={content}
      theme={theme}
      options={{ ...editorOptions, readOnly: !editable, wordWrap: wordWrap ? "on" : "off", minimap: { ...editorOptions.minimap, enabled: minimap }, fontSize }}
      onChange={(value) => onChange?.(value ?? "")}
      onMount={(editor) => {
        editorRef.current = editor;
        if (line && line > 0) editor.revealLineInCenter(line);
      }}
      loading={<div className="code-editor-loading">Starting local code editor…</div>}
    />
  );
}
