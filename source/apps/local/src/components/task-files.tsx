"use client";

import { Download, Link as LinkIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDialogs } from "@/components/dialogs";

type Attachment = {
  kind: "file" | "link";
  name: string;
  url?: string;
  size?: number;
  added_at: string;
  added_by?: string;
};

const maxBytes = 1_000_000;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function sizeLabel(size: number | undefined): string {
  if (size === undefined) return "";
  return size < 1000 ? `${size} B` : `${(size / 1000).toFixed(size < 100_000 ? 1 : 0)} KB`;
}

/** Small files (up to 1 MB) and links attached to the task. */
export function TaskFiles({
  taskId,
  attachments,
  onChanged,
  onNotice,
}: {
  taskId: string;
  attachments: readonly Attachment[];
  onChanged(): void;
  onNotice(message: string): void;
}) {
  const { confirm } = useDialogs();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const base = `/api/runtime/workspace/task/${encodeURIComponent(taskId)}/attachments`;
  async function send(request: () => Promise<Response>, success: string): Promise<void> {
    setBusy(true);
    try {
      const response = await request();
      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "The request failed");
      }
      onNotice(success);
      onChanged();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The request failed");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > maxBytes) {
      onNotice("Files over 1 MB cannot be stored yet. Add a link to the file instead.");
      return;
    }
    const data = toBase64(new Uint8Array(await file.arrayBuffer()));
    await send(
      () =>
        fetch(base, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: file.name, contentBase64: data }),
        }),
      `Attached ${file.name}`,
    );
  }
  return (
    <div className="task-files">
      <div className="files-add">
        <label className="files-upload">
          <input
            type="file"
            disabled={busy}
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          Add a file (up to 1 MB)
        </label>
        <form
          className="files-link"
          onSubmit={(event) => {
            event.preventDefault();
            if (!url.trim()) return;
            void send(
              () =>
                fetch(base, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    url: url.trim(),
                    ...(label.trim() ? { name: label.trim() } : {}),
                  }),
                }),
              "Link added",
            ).then(() => {
              setUrl("");
              setLabel("");
            });
          }}
        >
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://… link to a larger file"
            aria-label="Link address"
          />
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Name (optional)"
            aria-label="Link name"
          />
          <button type="submit" disabled={busy || !url.trim()}>
            Add link
          </button>
        </form>
      </div>
      {attachments.length === 0 ? (
        <p className="sub">No files or links yet.</p>
      ) : (
        <ul className="files-list">
          {attachments.map((attachment) => (
            <li key={`${attachment.kind}:${attachment.name}`}>
              {attachment.kind === "link" ? (
                <LinkIcon className="size-4" />
              ) : (
                <Download className="size-4" />
              )}
              {attachment.kind === "link" && attachment.url ? (
                <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                  {attachment.name}
                </a>
              ) : (
                <a
                  href={`${base}/${encodeURIComponent(attachment.name)}`}
                  download={attachment.name}
                >
                  {attachment.name}
                </a>
              )}
              <small className="sub">
                {sizeLabel(attachment.size)} {attachment.added_by ? `· ${attachment.added_by}` : ""}
              </small>
              <span className="gap" />
              <button
                type="button"
                aria-label={`Remove ${attachment.name}`}
                disabled={busy}
                onClick={() => {
                  void confirm({
                    title: `Remove ${attachment.name}?`,
                    message:
                      attachment.kind === "file"
                        ? "The stored file is deleted."
                        : "The link is removed.",
                    confirmLabel: "Remove",
                    danger: true,
                  }).then((ok) => {
                    if (ok)
                      void send(
                        () =>
                          fetch(`${base}/${encodeURIComponent(attachment.name)}`, {
                            method: "DELETE",
                          }),
                        "Removed",
                      );
                  });
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
