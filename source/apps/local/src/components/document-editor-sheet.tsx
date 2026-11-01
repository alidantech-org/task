"use client";

import { Button } from "@task/ui";
import {
  Bold,
  Code,
  Columns2,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  PenLine,
  Quote,
  RotateCcw,
  Save,
  Strikethrough,
  Table,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { useDialogs } from "@/components/dialogs";
import {
  type EditorAction,
  type EditorController,
  type EditorMode,
  MarkdownSurface,
} from "@/components/markdown-editor";
import { SheetShell } from "@/components/sheet-shell";

type ToolItem = { action: EditorAction; label: string; icon: typeof Bold };
const toolGroups: readonly (readonly ToolItem[])[] = [
  [
    { action: "h1", label: "Heading 1", icon: Heading1 },
    { action: "h2", label: "Heading 2", icon: Heading2 },
    { action: "h3", label: "Heading 3", icon: Heading3 },
  ],
  [
    { action: "bold", label: "Bold", icon: Bold },
    { action: "italic", label: "Italic", icon: Italic },
    { action: "strike", label: "Strikethrough", icon: Strikethrough },
    { action: "code", label: "Inline code", icon: Code },
  ],
  [
    { action: "bullet", label: "Bulleted list", icon: List },
    { action: "ordered", label: "Numbered list", icon: ListOrdered },
    { action: "task", label: "Checklist", icon: ListChecks },
  ],
  [
    { action: "link", label: "Link", icon: LinkIcon },
    { action: "table", label: "Table", icon: Table },
    { action: "quote", label: "Quote", icon: Quote },
    { action: "codeblock", label: "Code block", icon: FileCode },
    { action: "rule", label: "Divider", icon: Minus },
  ],
];
const modes: readonly { id: EditorMode; label: string; icon: typeof Bold }[] = [
  { id: "rich", label: "Rich text", icon: PenLine },
  { id: "code", label: "Markdown", icon: FileCode },
  { id: "split", label: "Split", icon: Columns2 },
];

type Props = {
  title: string;
  path: string;
  /** The draft being edited. */
  value: string;
  /** The last saved text; the draft differs from it when there are unsaved changes. */
  savedValue: string;
  onChange(markdown: string): void;
  onSave(): Promise<void>;
  /** Closes the sheet; called after the user confirms discarding unsaved changes. */
  onClose(): void;
  onError?(message: string): void;
  saving: boolean;
  /** Rendered beside the source in split mode. */
  preview: ReactNode;
  /** Shown under the toolbar, for example a conflict warning. */
  banner?: ReactNode;
};

/**
 * Full-height document editor in a resizable sheet: back arrow, title and path, mode switch and
 * save in the header, the formatting toolbar in the bar below, and an unpadded editing surface.
 */
export function DocumentEditorSheet({
  title,
  path,
  value,
  savedValue,
  onChange,
  onSave,
  onClose,
  onError,
  saving,
  preview,
  banner,
}: Props) {
  const { confirm } = useDialogs();
  const [mode, setMode] = useState<EditorMode>("rich");
  const [revision, setRevision] = useState(0);
  const controller = useRef<EditorController | null>(null);
  const dirty = value !== savedValue;

  async function requestClose() {
    if (!dirty) return onClose();
    const discard = await confirm({
      title: "Discard unsaved changes?",
      message: "Your edits to this file have not been saved.",
      confirmLabel: "Discard",
      danger: true,
    });
    if (discard) {
      onChange(savedValue);
      onClose();
    }
  }

  return (
    <SheetShell
      title={title}
      meta={<code className="ed-path">{path}</code>}
      storageKey="editor-sheet-width"
      startWide
      flush
      onBack={() => void requestClose()}
      onClose={() => void requestClose()}
      actions={
        <>
          {dirty ? <span className="ed-dirty">Unsaved</span> : null}
          <fieldset className="seg ed-modes" aria-label="Editor mode">
            {modes.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                className={mode === id ? "on" : ""}
                aria-pressed={mode === id}
                title={label}
                onClick={() => setMode(id)}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </button>
            ))}
          </fieldset>
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty}
            onClick={() => {
              onChange(savedValue);
              setRevision((current) => current + 1);
            }}
          >
            <RotateCcw className="size-4" /> Revert
          </Button>
          <Button size="sm" disabled={saving || !dirty} onClick={() => void onSave()}>
            <Save className="size-4" /> {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
      subhead={
        <div className="ed-toolbar" role="toolbar" aria-label="Formatting">
          {toolGroups.map((group) => (
            <div className="ed-group" key={group[0]?.action}>
              {group.map(({ action, label, icon: Icon }) => (
                <button
                  type="button"
                  key={action}
                  title={label}
                  aria-label={label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => controller.current?.run(action)}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          ))}
        </div>
      }
    >
      {banner}
      <MarkdownSurface
        key={`${mode === "split" ? "code" : mode}:${revision}`}
        mode={mode}
        value={value}
        onChange={onChange}
        onError={onError}
        controller={controller}
        preview={preview}
      />
    </SheetShell>
  );
}
