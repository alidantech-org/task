"use client";

import { useEffect, useState } from "react";
import { useDialogs } from "@/components/dialogs";
import { relativeTime, splitMentions } from "@/lib/mentions";

type Comment = { index: number; at: string; author?: string; text: string };

function Text({ text }: { text: string }) {
  return (
    <p className="cm-text">
      {splitMentions(text).map((part, index) =>
        part.mention ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and never reordered
          <mark key={index} className="mention">
            {part.text}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and never reordered
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

/** The task's comments with author, time and highlighted @mentions, plus a composer. */
export function TaskComments({
  taskId,
  onChanged,
  onNotice,
}: {
  taskId: string;
  onChanged(): void;
  onNotice(message: string): void;
}) {
  const { confirm } = useDialogs();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/runtime/workspace/task/${encodeURIComponent(taskId)}/comments`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload when another task opens.
  useEffect(() => {
    let active = true;
    setComments(null);
    setText("");
    void fetch(base, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { comments?: Comment[] };
        if (active && response.ok) setComments(payload.comments ?? []);
      })
      .catch(() => {
        if (active) setComments([]);
      });
    return () => {
      active = false;
    };
  }, [taskId]);
  async function send(request: Promise<Response>): Promise<void> {
    setBusy(true);
    try {
      const response = await request;
      const payload = (await response.json()) as {
        comments?: Comment[];
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not save the comment");
      setComments(payload.comments ?? []);
      onChanged();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not save the comment");
    } finally {
      setBusy(false);
    }
  }
  async function add() {
    if (!text.trim()) return;
    await send(
      fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      }),
    );
    setText("");
  }
  return (
    <div className="task-comments">
      <form
        className="cm-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <textarea
          value={text}
          rows={3}
          aria-label="Write a comment"
          placeholder="Write a comment. Use @name to mention someone."
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void add();
            }
          }}
        />
        <div className="cm-actions">
          <small className="sub">Ctrl/Cmd + Enter to post</small>
          <button type="submit" className="cm-post" disabled={busy || !text.trim()}>
            {busy ? "Posting…" : "Comment"}
          </button>
        </div>
      </form>
      {comments === null && <p className="sub">Loading comments…</p>}
      {comments?.length === 0 && <p className="sub">No comments yet. Start the conversation.</p>}
      <ul className="cm-list">
        {[...(comments ?? [])].reverse().map((comment) => (
          <li key={comment.index}>
            <b className="av" aria-hidden="true">
              {(comment.author ?? "?").slice(0, 2).toLocaleUpperCase()}
            </b>
            <div>
              <header>
                <strong>{comment.author ?? "Unknown"}</strong>
                <time dateTime={comment.at} title={comment.at}>
                  {relativeTime(comment.at)}
                </time>
                <button
                  type="button"
                  className="cm-delete"
                  aria-label="Delete comment"
                  disabled={busy}
                  onClick={() => {
                    void confirm({
                      title: "Delete this comment?",
                      message: "The comment is removed from the task.",
                      confirmLabel: "Delete",
                      danger: true,
                    }).then((ok) => {
                      if (ok) void send(fetch(`${base}/${comment.index}`, { method: "DELETE" }));
                    });
                  }}
                >
                  Delete
                </button>
              </header>
              <Text text={comment.text} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
