"use client";

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
  MoreHorizontal,
  PenLine,
  Quote,
  Redo2,
  RotateCcw,
  Strikethrough,
  Table,
  Undo2,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
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
  { id: "code", label: "Markdown source", icon: FileCode },
  { id: "split", label: "Split view", icon: Columns2 },
];
const saveDelay = 1000;
/** Room kept free for undo, redo, revert and the mode switch on the right of the toolbar. */
const rightReserve = 240;
const groupWidth = (group: readonly ToolItem[]) => group.length * 34 + 17;
const moreWidth = 40;

type Props = {
  title: string;
  path: string;
  /** The draft being edited. */
  value: string;
  /** The last saved text. */
  savedValue: string;
  onChange(markdown: string): void;
  /** Saves the draft quietly; resolves false when it could not be saved. */
  onSave(): Promise<boolean>;
  onClose(): void;
  onError?(message: string): void;
  /** Rendered beside the source in split mode. */
  preview: ReactNode;
  /** Shown under the toolbar, for example a conflict warning. */
  banner?: ReactNode;
};

type SaveState = "saved" | "pending" | "saving" | "error";
const saveLabels: Record<SaveState, string> = {
  saved: "Saved",
  pending: "Editing…",
  saving: "Saving…",
  error: "Not saved",
};

/**
 * Full-height document editor in a resizable sheet. Changes are saved automatically a moment after
 * typing stops. The header is just the file; the bar below holds the formatting tools (collapsing
 * into a menu when narrow), undo, redo, revert and the view switch.
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
  preview,
  banner,
}: Props) {
  const { confirm } = useDialogs();
  const [mode, setMode] = useState<EditorMode>("rich");
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<SaveState>("saved");
  const [visibleGroups, setVisibleGroups] = useState(toolGroups.length);
  const controller = useRef<EditorController | null>(null);
  const initial = useRef(value);
  const inFlight = useRef(false);
  const toolbar = useRef<HTMLDivElement>(null);
  const dirty = value !== savedValue;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (value === savedValue) {
      if (!inFlight.current) setState("saved");
      return;
    }
    setState((current) => (current === "saving" ? current : "pending"));
    const timer = window.setTimeout(() => {
      if (inFlight.current) return;
      inFlight.current = true;
      setState("saving");
      void onSaveRef
        .current()
        .then((ok) => setState(ok ? "saved" : "error"))
        .catch(() => setState("error"))
        .finally(() => {
          inFlight.current = false;
        });
    }, saveDelay);
    return () => window.clearTimeout(timer);
  }, [value, savedValue]);

  // Fit as many tool groups as the bar allows; the rest move into the "…" menu.
  useEffect(() => {
    const element = toolbar.current;
    if (!element) return;
    const fit = () => {
      const available = element.clientWidth - rightReserve;
      const widths = toolGroups.map(groupWidth);
      const fits = (count: number) => {
        const used = widths.slice(0, count).reduce((sum, width) => sum + width, 0);
        return used + (count < toolGroups.length ? moreWidth : 0) <= available;
      };
      let count = toolGroups.length;
      while (count > 0 && !fits(count)) count -= 1;
      setVisibleGroups(count);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  async function requestClose() {
    if (dirty) {
      const ok = await onSave().catch(() => false);
      if (!ok) {
        const discard = await confirm({
          title: "Close without saving?",
          message: "The latest changes could not be saved.",
          confirmLabel: "Close anyway",
          danger: true,
        });
        if (!discard) return;
      }
    }
    onClose();
  }

  const run = (action: EditorAction) => controller.current?.run(action);
  const hidden = toolGroups.slice(visibleGroups).flat();

  return (
    <SheetShell
      title={title}
      meta={
        <>
          <code className="ed-path">{path}</code>
          <span className={`ed-state ${state}`}>{saveLabels[state]}</span>
        </>
      }
      storageKey="editor-sheet-width"
      startWide
      flush
      onBack={() => void requestClose()}
      onClose={() => void requestClose()}
      subhead={
        <div className="ed-toolbar" role="toolbar" aria-label="Formatting" ref={toolbar}>
          <div className="ed-tools">
            {toolGroups.slice(0, visibleGroups).map((group) => (
              <div className="ed-group" key={group[0]?.action}>
                {group.map(({ action, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={action}
                    title={label}
                    aria-label={label}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => run(action)}
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>
            ))}
            {hidden.length > 0 && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button type="button" title="More formatting" aria-label="More formatting">
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="task-sheet-menu ed-more" align="start">
                    {hidden.map(({ action, label, icon: Icon }) => (
                      <DropdownMenu.Item key={action} onSelect={() => run(action)}>
                        <Icon className="size-4" /> {label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>
          <div className="ed-right">
            <button
              type="button"
              title="Undo"
              aria-label="Undo"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => controller.current?.undo()}
            >
              <Undo2 className="size-4" />
            </button>
            <button
              type="button"
              title="Redo"
              aria-label="Redo"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => controller.current?.redo()}
            >
              <Redo2 className="size-4" />
            </button>
            <button
              type="button"
              title="Revert to how the file was when you opened it"
              aria-label="Revert changes"
              disabled={value === initial.current}
              onClick={() => {
                onChange(initial.current);
                setRevision((current) => current + 1);
              }}
            >
              <RotateCcw className="size-4" />
            </button>
            <fieldset className="ed-capsule" aria-label="Editor view">
              {modes.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  className={mode === id ? "on" : ""}
                  aria-pressed={mode === id}
                  title={label}
                  aria-label={label}
                  onClick={() => setMode(id)}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </fieldset>
          </div>
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
