"use client";

import { useEffect, useState } from "react";
import { relativeTime } from "@/lib/mentions";

type Entry = { at: string; kind: string; text: string; author?: string };

const kindLabels: Record<string, string> = {
  created: "Created",
  status: "Status",
  comment: "Comment",
  tracking: "Changes",
  attachment: "File",
  updated: "Updated",
};

/** One timeline of status changes, comments, tracked changes and files for the task. */
export function TaskActivity({ taskId, refreshKey }: { taskId: string; refreshKey: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey reloads the timeline after changes.
  useEffect(() => {
    let active = true;
    void fetch(`/api/runtime/workspace/task/${encodeURIComponent(taskId)}/activity`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as { activity?: Entry[] };
        if (active && response.ok) setEntries(payload.activity ?? []);
      })
      .catch(() => {
        if (active) setEntries([]);
      });
    return () => {
      active = false;
    };
  }, [taskId, refreshKey]);
  if (entries === null) return <p className="sub">Loading activity…</p>;
  if (entries.length === 0) return <p className="sub">No activity yet.</p>;
  return (
    <ol className="task-activity">
      {entries.map((entry) => (
        <li key={`${entry.at}:${entry.kind}:${entry.text}`}>
          <span className={`act-kind act-${entry.kind}`}>
            {kindLabels[entry.kind] ?? entry.kind}
          </span>
          <span className="act-text">{entry.text}</span>
          <time dateTime={entry.at} title={entry.at}>
            {entry.author ? `${entry.author} · ` : ""}
            {relativeTime(entry.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
