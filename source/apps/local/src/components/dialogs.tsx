"use client";

import { Button } from "@task/ui";
import { Dialog } from "radix-ui";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Style the confirm button as a destructive action. */
  danger?: boolean;
};

export type PromptOptions = {
  title: string;
  label: string;
  placeholder?: string;
  initial?: string;
  confirmLabel?: string;
};

export type DialogApi = {
  confirm(options: ConfirmOptions): Promise<boolean>;
  prompt(options: PromptOptions): Promise<string | null>;
};

type Pending =
  | { kind: "confirm"; options: ConfirmOptions; resolve(value: boolean): void }
  | { kind: "prompt"; options: PromptOptions; resolve(value: string | null): void };

const DialogContext = createContext<DialogApi | null>(null);

/** Without a provider (for example in static rendering) dialogs decline instead of using browser popups. */
const declining: DialogApi = {
  confirm: async () => false,
  prompt: async () => null,
};

export function useDialogs(): DialogApi {
  return useContext(DialogContext) ?? declining;
}

/** Hosts the app's own confirm and prompt dialogs, replacing the browser's alert-style popups. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [text, setText] = useState("");
  const queue = useRef<Pending[]>([]);

  const show = useCallback((next: Pending) => {
    setPending((current) => {
      if (current) {
        queue.current.push(next);
        return current;
      }
      if (next.kind === "prompt") setText(next.options.initial ?? "");
      return next;
    });
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (options) => new Promise((resolve) => show({ kind: "confirm", options, resolve })),
      prompt: (options) => new Promise((resolve) => show({ kind: "prompt", options, resolve })),
    }),
    [show],
  );

  function finish(accepted: boolean) {
    if (!pending) return;
    if (pending.kind === "confirm") pending.resolve(accepted);
    else pending.resolve(accepted && text.trim() ? text.trim() : null);
    const next = queue.current.shift() ?? null;
    if (next?.kind === "prompt") setText(next.options.initial ?? "");
    setPending(next);
  }

  const options = pending?.options;
  const danger = pending?.kind === "confirm" && pending.options.danger;
  return (
    <DialogContext.Provider value={api}>
      {children}
      <Dialog.Root open={pending !== null} onOpenChange={(open) => !open && finish(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="app-dialog-overlay" />
          <Dialog.Content className="app-dialog" aria-describedby={undefined}>
            <Dialog.Title className="app-dialog-title">{options?.title}</Dialog.Title>
            {pending?.kind === "confirm" && pending.options.message ? (
              <p className="app-dialog-message">{pending.options.message}</p>
            ) : null}
            {pending?.kind === "prompt" ? (
              <label className="app-dialog-field">
                <span>{pending.options.label}</span>
                <input
                  // biome-ignore lint/a11y/noAutofocus: the dialog exists to take this input.
                  autoFocus
                  value={text}
                  placeholder={pending.options.placeholder}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      finish(true);
                    }
                  }}
                />
              </label>
            ) : null}
            <div className="app-dialog-actions">
              <Button variant="outline" onClick={() => finish(false)}>
                Cancel
              </Button>
              <Button
                className={danger ? "app-dialog-danger" : "cta"}
                disabled={pending?.kind === "prompt" && !text.trim()}
                onClick={() => finish(true)}
              >
                {options?.confirmLabel ?? (pending?.kind === "prompt" ? "Save" : "Confirm")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </DialogContext.Provider>
  );
}
