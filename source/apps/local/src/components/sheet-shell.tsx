"use client";

import { Button } from "@task/ui";
import { ArrowLeft, Maximize2, Minimize2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  clampStoredWidth,
  defaultSheetWidth,
  minSheetWidth,
  resolveSheetWidth,
  wideSheetWidth,
} from "@/lib/sheet-width";

type SheetShellProps = {
  title: ReactNode;
  /** One line of small text under the title. */
  meta?: ReactNode;
  /** Controls placed before the expand and close buttons. */
  actions?: ReactNode;
  /** The bordered bar under the header. */
  subhead?: ReactNode;
  children: ReactNode;
  onClose(): void;
  /** Where the user's chosen width is remembered. */
  storageKey: string;
  /** Shows a back arrow before the title. */
  onBack?: () => void;
  /** Removes the body padding so the content spans the whole sheet. */
  flush?: boolean;
  /** Opens wide the first time, before the user has chosen a width. */
  startWide?: boolean;
};

/**
 * The shared look of the dashboard's side sheets: a blurred backdrop, a compact header, a bordered
 * secondary bar, a drag handle on the left edge for resizing (hiding when dragged below the
 * minimum), and expand and close buttons.
 */
export function SheetShell({
  title,
  meta,
  actions,
  subhead,
  children,
  onClose,
  storageKey,
  onBack,
  flush = false,
  startWide = false,
}: SheetShellProps) {
  const [width, setWidth] = useState(defaultSheetWidth);
  const [resizing, setResizing] = useState<"idle" | "drag" | "hide">("idle");
  const widthBeforeDrag = useRef(defaultSheetWidth);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      setWidth(
        stored === null && startWide
          ? resolveSheetWidth(wideSheetWidth, window.innerWidth).width
          : clampStoredWidth(stored, window.innerWidth),
      );
    } catch {
      setWidth(defaultSheetWidth);
    }
  }, [storageKey, startWide]);
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  function store(next: number) {
    try {
      window.localStorage.setItem(storageKey, String(next));
    } catch {
      // The width is a convenience only.
    }
  }
  const expanded = width > 800;
  function toggleExpanded() {
    const next = expanded
      ? defaultSheetWidth
      : resolveSheetWidth(wideSheetWidth, window.innerWidth).width;
    setWidth(next);
    store(next);
  }
  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    widthBeforeDrag.current = width;
    let latest = resolveSheetWidth(width, window.innerWidth);
    setResizing("drag");
    const move = (moveEvent: PointerEvent) => {
      latest = resolveSheetWidth(window.innerWidth - moveEvent.clientX, window.innerWidth);
      setWidth(latest.width);
      setResizing(latest.hide ? "hide" : "drag");
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      setResizing("idle");
      if (latest.hide) {
        setWidth(widthBeforeDrag.current);
        onClose();
      } else store(latest.width);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }
  function resizeWithKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowLeft" ? 24 : event.key === "ArrowRight" ? -24 : 0;
    if (!step) return;
    event.preventDefault();
    const next = resolveSheetWidth(width + step, window.innerWidth);
    const applied = next.hide ? minSheetWidth : next.width;
    setWidth(applied);
    store(applied);
  }
  const compact = Math.min(width, viewportWidth || width) < 520;

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="task-sheet-overlay" />
        <Dialog.Content
          className={`task-sheet ${resizing === "idle" ? "" : "resizing"} ${resizing === "hide" ? "will-hide" : ""} ${compact ? "compact" : ""}`}
          style={{ width: `min(${width}px, 100vw)` }}
          aria-describedby={undefined}
        >
          {/* biome-ignore lint/a11y/useSemanticElements: the WAI-ARIA window splitter pattern needs a focusable separator */}
          <div
            className="task-sheet-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sheet"
            aria-valuenow={width}
            aria-valuemin={minSheetWidth}
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={resizeWithKeyboard}
          />
          <header className="task-sheet-head">
            {onBack ? (
              <Button
                variant="ghost"
                size="icon"
                className="sheet-icon"
                aria-label="Back"
                onClick={onBack}
              >
                <ArrowLeft className="size-4" />
              </Button>
            ) : null}
            <div className="min-w-0 flex-1">
              <Dialog.Title asChild>
                <h2 className="task-sheet-title">{title}</h2>
              </Dialog.Title>
              {meta ? <p className="task-sheet-meta">{meta}</p> : null}
            </div>
            <div className="task-sheet-actions">
              {actions}
              <Button
                variant="ghost"
                size="icon"
                className="sheet-icon"
                aria-label={expanded ? "Shrink sheet" : "Expand sheet"}
                onClick={toggleExpanded}
              >
                {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="sheet-icon"
                aria-label="Close sheet"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </div>
          </header>
          {subhead ? <div className="task-sheet-subhead">{subhead}</div> : null}
          <div className={`task-sheet-body ${flush ? "flush" : ""}`.trim()}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
