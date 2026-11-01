"use client";

import { Crepe } from "@milkdown/crepe";
import { useEffect, useRef, useState } from "react";
import { CustomSelect } from "@/components/ui/select";

type MarkdownEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  onError?: (message: string) => void;
  className?: string;
};

type EditMode = "rich" | "code";
type FormatAction =
  | "bold"
  | "italic"
  | "heading"
  | "list"
  | "task"
  | "quote"
  | "code"
  | "link"
  | "wiki";

const imageTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);
const maxInlineImageBytes = 1_500_000;

const actions: { key: FormatAction; label: string }[] = [
  { key: "bold", label: "B" },
  { key: "italic", label: "I" },
  { key: "heading", label: "H2" },
  { key: "list", label: "• List" },
  { key: "task", label: "☑ Task" },
  { key: "quote", label: "❝ Quote" },
  { key: "code", label: "‹/› Code" },
  { key: "link", label: "Link" },
  { key: "wiki", label: "[[ ]] Link file" },
];

const wrappers: Partial<Record<FormatAction, readonly [string, string]>> = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  code: ["`", "`"],
  wiki: ["[[", "]]"],
  link: ["[", "](https://)"],
};
const prefixes: Partial<Record<FormatAction, string>> = {
  heading: "## ",
  list: "- ",
  task: "- [ ] ",
  quote: "> ",
};

function wordCount(markdown: string): number {
  return (markdown.match(/\S+/g) ?? []).length;
}

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

function RichMarkdownEditor({
  value,
  onChange,
  onError,
}: Pick<MarkdownEditorProps, "value" | "onChange" | "onError">) {
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
        [Crepe.Feature.TopBar]: true,
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
    const ready = editor.create();
    void ready.catch((error: unknown) => {
      if (!disposed) {
        onErrorRef.current?.(
          error instanceof Error ? error.message : "Markdown editor failed to load.",
        );
      }
    });
    return () => {
      disposed = true;
      void ready.then(() => editor.destroy()).catch(() => undefined);
    };
  }, []);

  return <div ref={root} className="task-markdown-editor" />;
}

function CodeMarkdownEditor({ value, onChange }: Pick<MarkdownEditorProps, "value" | "onChange">) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  function format(action: FormatAction): void {
    const field = textarea.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = value.slice(start, end);
    const wrapper = wrappers[action];
    const prefix = prefixes[action];
    if (wrapper) {
      const text = `${wrapper[0]}${selected || "text"}${wrapper[1]}`;
      onChange(`${value.slice(0, start)}${text}${value.slice(end)}`);
      window.requestAnimationFrame(() => {
        field.focus();
        field.setSelectionRange(start, start + text.length);
      });
      return;
    }
    if (!prefix) return;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    onChange(`${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`);
    window.requestAnimationFrame(() => {
      field.focus();
      const caret = start + prefix.length;
      field.setSelectionRange(caret, caret);
    });
  }

  const words = wordCount(value);
  return (
    <div className="markdown-code-editor">
      <div className="tb">
        {actions.map(({ key, label }) => (
          <button
            type="button"
            key={key}
            aria-label={`Insert ${label}`}
            onClick={() => format(key)}
          >
            {key === "bold" ? <b>B</b> : key === "italic" ? <i>I</i> : label}
          </button>
        ))}
      </div>
      <textarea
        ref={textarea}
        id="ed"
        aria-label="Markdown source editor"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <small className="sub">
        {words} words · {Math.max(1, Math.round(words / 200))} min read
      </small>
    </div>
  );
}

export function MarkdownEditor({ value, onChange, onError, className = "" }: MarkdownEditorProps) {
  const [mode, setMode] = useState<EditMode>("rich");
  return (
    <div className={`markdown-editor ${className}`.trim()}>
      <div className="markdown-mode-row">
        <span className="markdown-mode-label">Edit as</span>
        <CustomSelect
          value={mode}
          onValueChange={(nextMode) => {
            if (nextMode === "rich" || nextMode === "code") setMode(nextMode);
          }}
          options={[
            { value: "rich", label: "Rich text" },
            { value: "code", label: "Markdown code" },
          ]}
          label="Markdown editing mode"
          className="markdown-mode-select"
        />
      </div>
      {mode === "rich" ? (
        <RichMarkdownEditor value={value} onChange={onChange} onError={onError} />
      ) : (
        <CodeMarkdownEditor value={value} onChange={onChange} />
      )}
    </div>
  );
}
