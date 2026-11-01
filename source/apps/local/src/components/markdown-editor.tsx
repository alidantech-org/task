"use client";

import { Crepe } from "@milkdown/crepe";
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
export type EditorController = { run(action: EditorAction): void };

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

function CodeSurface({ value, onChange, controller }: SurfaceProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    controller.current = {
      run(action) {
        const field = textarea.current;
        if (!field) return;
        const current = valueRef.current;
        const change = onChangeRef.current;
        const start = field.selectionStart;
        const end = field.selectionEnd;
        const wrapper = wrappers[action];
        const prefix = prefixes[action];
        const snippet = snippets[action];
        if (wrapper) {
          const text = `${wrapper[0]}${current.slice(start, end) || "text"}${wrapper[1]}`;
          change(`${current.slice(0, start)}${text}${current.slice(end)}`);
          window.requestAnimationFrame(() => {
            field.focus();
            field.setSelectionRange(start, start + text.length);
          });
        } else if (prefix) {
          const lineStart = current.lastIndexOf("\n", start - 1) + 1;
          change(`${current.slice(0, lineStart)}${prefix}${current.slice(lineStart)}`);
          window.requestAnimationFrame(() => {
            field.focus();
            field.setSelectionRange(start + prefix.length, start + prefix.length);
          });
        } else if (snippet) {
          change(`${current.slice(0, end)}${snippet}${current.slice(end)}`);
          window.requestAnimationFrame(() => field.focus());
        }
      },
    };
    return () => {
      controller.current = null;
    };
  }, [controller]);

  return (
    <textarea
      ref={textarea}
      className="md-source"
      aria-label="Markdown source editor"
      spellCheck={false}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
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
