"use client";

import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorSelection, EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { Crepe } from "@milkdown/crepe";
import { redoCommand, undoCommand } from "@milkdown/kit/plugin/history";
import {
  createCodeBlockCommand,
  insertHrCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { insertTableCommand, toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { callCommand, insert } from "@milkdown/kit/utils";
import { type MutableRefObject, type ReactNode, useEffect, useRef } from "react";

export type EditorMode = "rich" | "code" | "split";
export type EditorAction =
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "ordered"
  | "task"
  | "quote"
  | "codeblock"
  | "link"
  | "table"
  | "rule";
/** What the toolbar calls; each surface registers how it applies an action. */
export type EditorController = { run(action: EditorAction): void; undo(): void; redo(): void };

type SurfaceProps = {
  value: string;
  onChange: (markdown: string) => void;
  onError?: (message: string) => void;
  mode: EditorMode;
  controller: MutableRefObject<EditorController | null>;
  /** Rendered next to the source in split mode. */
  preview?: ReactNode;
};

const imageTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);
const maxInlineImageBytes = 1_500_000;

const wrappers: Partial<Record<EditorAction, readonly [string, string]>> = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  strike: ["~~", "~~"],
  code: ["`", "`"],
  codeblock: ["```\n", "\n```"],
  link: ["[", "](https://)"],
};
const prefixes: Partial<Record<EditorAction, string>> = {
  h1: "# ",
  h2: "## ",
  h3: "### ",
  bullet: "- ",
  ordered: "1. ",
  task: "- [ ] ",
  quote: "> ",
};
const snippets: Partial<Record<EditorAction, string>> = {
  table: "\n| Column | Column |\n| --- | --- |\n| Value | Value |\n",
  rule: "\n---\n",
};

function imageAsDataUrl(file: File): Promise<string> {
  if (!imageTypes.has(file.type)) {
    return Promise.reject(new Error("Choose a PNG, JPEG, GIF, WebP, or AVIF image."));
  }
  if (file.size > maxInlineImageBytes) {
    return Promise.reject(new Error("Markdown images must be 1.5 MB or smaller."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read this image."));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
}

function RichSurface({ value, onChange, onError, controller }: SurfaceProps) {
  const root = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);
  valueRef.current = value;
  onChangeRef.current = onChange;
  onErrorRef.current = onError;

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const editor = new Crepe({
      root: element,
      defaultValue: valueRef.current,
      features: {
        [Crepe.Feature.TopBar]: false,
        [Crepe.Feature.Toolbar]: true,
        [Crepe.Feature.ImageBlock]: true,
        [Crepe.Feature.Table]: true,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: "Write in Markdown…", mode: "block" },
        [Crepe.Feature.ImageBlock]: {
          onUpload: async (file) => {
            try {
              return await imageAsDataUrl(file);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Image upload failed.";
              onErrorRef.current?.(message);
              throw error;
            }
          },
        },
      },
    });
    let skipInitialMarkdownUpdate = true;
    editor.on((listener) => {
      listener.markdownUpdated((_context, markdown) => {
        if (skipInitialMarkdownUpdate) {
          skipInitialMarkdownUpdate = false;
          return;
        }
        onChangeRef.current(markdown);
      });
    });
    let disposed = false;
    let ready = false;
    const created = editor.create();
    void created
      .then(() => {
        ready = true;
      })
      .catch((error: unknown) => {
        if (!disposed) {
          onErrorRef.current?.(
            error instanceof Error ? error.message : "Markdown editor failed to load.",
          );
        }
      });
    controller.current = {
      undo() {
        if (ready) editor.editor.action(callCommand(undoCommand.key));
      },
      redo() {
        if (ready) editor.editor.action(callCommand(redoCommand.key));
      },
      run(action) {
        if (!ready) return;
        const apply = (callback: Parameters<typeof editor.editor.action>[0]) =>
          editor.editor.action(callback);
        const heading = { h1: 1, h2: 2, h3: 3 } as const;
        if (action === "h1" || action === "h2" || action === "h3")
          apply(callCommand(wrapInHeadingCommand.key, heading[action]));
        else if (action === "bold") apply(callCommand(toggleStrongCommand.key));
        else if (action === "italic") apply(callCommand(toggleEmphasisCommand.key));
        else if (action === "strike") apply(callCommand(toggleStrikethroughCommand.key));
        else if (action === "code") apply(callCommand(toggleInlineCodeCommand.key));
        else if (action === "bullet") apply(callCommand(wrapInBulletListCommand.key));
        else if (action === "ordered") apply(callCommand(wrapInOrderedListCommand.key));
        else if (action === "quote") apply(callCommand(wrapInBlockquoteCommand.key));
        else if (action === "codeblock") apply(callCommand(createCodeBlockCommand.key));
        else if (action === "rule") apply(callCommand(insertHrCommand.key));
        else if (action === "table") apply(callCommand(insertTableCommand.key));
        else if (action === "link") apply(callCommand(toggleLinkCommand.key, { href: "https://" }));
        else if (action === "task") apply(insert("- [ ] Task\n"));
      },
    };
    return () => {
      disposed = true;
      controller.current = null;
      void created.then(() => editor.destroy()).catch(() => undefined);
    };
  }, [controller]);

  return <div ref={root} className="md-rich" />;
}

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: "var(--acc)", fontWeight: "700", fontSize: "1.25em" },
  { tag: tags.heading2, color: "var(--acc)", fontWeight: "700", fontSize: "1.12em" },
  {
    tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6],
    color: "var(--acc)",
    fontWeight: "700",
  },
  { tag: tags.strong, fontWeight: "700", color: "var(--ink)" },
  { tag: tags.emphasis, fontStyle: "italic", color: "var(--ink)" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "var(--mut)" },
  { tag: tags.link, color: "oklch(0.62 0.15 250)", textDecoration: "underline" },
  { tag: tags.url, color: "oklch(0.62 0.15 250)" },
  {
    tag: tags.monospace,
    color: "oklch(0.64 0.14 40)",
    fontFamily: "ui-monospace, Menlo, monospace",
  },
  { tag: tags.quote, color: "oklch(0.6 0.1 150)", fontStyle: "italic" },
  { tag: tags.list, color: "oklch(0.65 0.16 320)" },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: "var(--mut)" },
]);

const sourceTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "var(--ink)", fontSize: "13.5px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    lineHeight: "1.7",
    overflow: "auto",
  },
  ".cm-content": { padding: "16px 0 80px", caretColor: "var(--acc)" },
  ".cm-line": { padding: "0 24px 0 8px" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--mut)",
    border: "none",
    opacity: "0.7",
  },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--soft) 70%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ink)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--acc) 28%, transparent)",
  },
});

/** A VS Code-style Markdown source editor: highlighting, line numbers, word wrap and undo history. */
function CodeSurface({ value, onChange, controller }: SurfaceProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValue = useRef(value);
  onChangeRef.current = onChange;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const editor = new EditorView({
      parent: element,
      state: EditorState.create({
        doc: initialValue.current,
        extensions: [
          history(),
          drawSelection(),
          lineNumbers(),
          highlightActiveLine(),
          EditorView.lineWrapping,
          markdown(),
          syntaxHighlighting(markdownHighlight),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          sourceTheme,
          EditorView.contentAttributes.of({ "aria-label": "Markdown source editor" }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    controller.current = {
      undo: () => {
        undo(editor);
        editor.focus();
      },
      redo: () => {
        redo(editor);
        editor.focus();
      },
      run(action) {
        const wrapper = wrappers[action];
        const prefix = prefixes[action];
        const snippet = snippets[action];
        editor.dispatch(
          editor.state.changeByRange((range) => {
            if (wrapper) {
              const text = editor.state.sliceDoc(range.from, range.to) || "text";
              const insertion = `${wrapper[0]}${text}${wrapper[1]}`;
              return {
                changes: { from: range.from, to: range.to, insert: insertion },
                range: EditorSelection.range(
                  range.from + wrapper[0].length,
                  range.from + wrapper[0].length + text.length,
                ),
              };
            }
            if (prefix) {
              const line = editor.state.doc.lineAt(range.from);
              return {
                changes: { from: line.from, insert: prefix },
                range: EditorSelection.range(
                  range.anchor + prefix.length,
                  range.head + prefix.length,
                ),
              };
            }
            if (snippet) return { changes: { from: range.to, insert: snippet }, range };
            return { range };
          }),
        );
        editor.focus();
      },
    };
    return () => {
      controller.current = null;
      view.current = null;
      editor.destroy();
    };
  }, [controller]);

  // Keep the document in step when the value is replaced from outside, for example by Revert.
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value)
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} className="md-source" />;
}

/** The editing area itself: it fills its container and has no padding, border or card. */
export function MarkdownSurface(props: SurfaceProps) {
  if (props.mode === "rich") return <RichSurface {...props} />;
  if (props.mode === "code") return <CodeSurface {...props} />;
  return (
    <div className="md-split">
      <CodeSurface {...props} />
      <div className="md-preview">{props.preview}</div>
    </div>
  );
}
