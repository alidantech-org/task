"use client";

import { Button } from "@task/ui";
import { Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type PromptRecord = {
  path: string;
  id: string;
  name: string;
  type: string;
  status?: string;
  due_at?: string;
  contentHash: string;
};
type PromptWorkspace = { projectRoot: string; projectName: string } | null;
type PromptStyle = "Implement" | "Review" | "Plan";
type PromptBody = { body: string; contentHash: string };

const promptInstructions: Record<PromptStyle, string> = {
  Implement:
    "Implement the tasks above. Follow the context documents and tick each checklist item as you finish it.",
  Review:
    "Review the work for these tasks. List risks, missing tests and anything that contradicts the context documents.",
  Plan: "Break these tasks into small steps with an order and a clear definition of done. Do not write code yet.",
};

function statusLabel(status: string | undefined): string {
  if (!status) return "Planned";
  return status
    .split("-")
    .map((part) => `${part.slice(0, 1).toLocaleUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function dueLabel(dueDate: string | undefined): string {
  if (!dueDate) return "none";
  const date = new Date(`${dueDate}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? dueDate
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

export function PromptBuilder({
  records,
  workspace,
  setNotice,
}: {
  records: PromptRecord[];
  workspace: PromptWorkspace;
  setNotice(message: string): void;
}) {
  const [selectedTasks, setSelectedTasks] = useState<string[]>(() =>
    records.some((record) => record.id === "TASK-17" && record.type === "task") ? ["TASK-17"] : [],
  );
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>(() =>
    records.some((record) => record.id === "brief" && record.type !== "task") ? ["brief"] : [],
  );
  const promptDefaultsApplied = useRef(false);
  const [style, setStyle] = useState<PromptStyle>("Implement");
  const [bodies, setBodies] = useState<Record<string, PromptBody>>({});
  const bodiesRef = useRef(bodies);
  bodiesRef.current = bodies;

  const tasks = records.filter(
    (record) =>
      record.type === "task" && record.status !== "completed" && record.status !== "archived",
  );
  const documents = records.filter((record) => record.type !== "task");
  const selectedRecords = useMemo(
    () =>
      records.filter(
        (record) => selectedTasks.includes(record.id) || selectedDocuments.includes(record.id),
      ),
    [records, selectedDocuments, selectedTasks],
  );
  const selectionKey = `${selectedTasks.join("\u0000")}\u0001${selectedDocuments.join("\u0000")}`;

  useEffect(() => {
    if (promptDefaultsApplied.current) return;
    const hasDefaultTask = records.some(
      (record) => record.id === "TASK-17" && record.type === "task",
    );
    const hasDefaultDocument = records.some(
      (record) => record.id === "brief" && record.type !== "task",
    );
    if (!hasDefaultTask && !hasDefaultDocument) return;
    promptDefaultsApplied.current = true;
    if (hasDefaultTask) setSelectedTasks(["TASK-17"]);
    if (hasDefaultDocument) setSelectedDocuments(["brief"]);
  }, [records]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Selection changes must re-check body hashes.
  useEffect(() => {
    let active = true;
    const missing = selectedRecords.filter(
      (record) => bodiesRef.current[record.id]?.contentHash !== record.contentHash,
    );
    if (!missing.length) return;
    void Promise.all(
      missing.map(async (record) => {
        try {
          const response = await fetch(
            `/api/runtime/workspace/document/${encodeURIComponent(record.id)}`,
            { cache: "no-store" },
          );
          const payload = (await response.json()) as {
            document?: { body?: string; contentHash?: string };
          };
          if (!response.ok || !payload.document) throw new Error("Could not load prompt context");
          return {
            id: record.id,
            body: payload.document.body ?? "",
            contentHash: payload.document.contentHash ?? record.contentHash,
          };
        } catch {
          return { id: record.id, body: "", contentHash: record.contentHash };
        }
      }),
    ).then((loaded) => {
      if (!active) return;
      setBodies((current) => {
        const next = { ...current };
        for (const item of loaded) next[item.id] = item;
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, [selectionKey, selectedRecords]);

  const prompt = useMemo(() => {
    const selectedTaskRecords = records.filter((record) => selectedTasks.includes(record.id));
    const selectedDocumentRecords = records.filter((record) =>
      selectedDocuments.includes(record.id),
    );
    const taskText = selectedTaskRecords
      .map((task) => {
        const body = bodies[task.id]?.body;
        return `### ${task.id} — ${task.name}\nStatus: ${statusLabel(task.status)} · Due: ${dueLabel(task.due_at)}\n\n${body?.trim() || (body === undefined ? "_Loading task…_" : "")}`;
      })
      .join("\n\n");
    const documentText = selectedDocumentRecords
      .map((document) => {
        const body = bodies[document.id]?.body;
        return `### ${document.name} (${document.path})\n${body === undefined ? "_Loading document…_" : body.trim().slice(0, 500)}`;
      })
      .join("\n\n");
    return `# ${style} — ${workspace?.projectName ?? "Task workspace"}\n\n## Tasks\n${taskText || "_No tasks selected._"}\n\n## Context documents\n${documentText || "_None._"}\n\n## Instructions\n${promptInstructions[style]}\n`;
  }, [bodies, records, selectedDocuments, selectedTasks, style, workspace?.projectName]);

  const wordCount = (prompt.match(/\S+/g) ?? []).length;
  const contextReady = selectedRecords.every(
    (record) => bodies[record.id]?.contentHash === record.contentHash,
  );

  async function copyPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice("Prompt copied");
    } catch {
      setNotice("Could not copy prompt to the clipboard");
    }
  }

  return (
    <div className="prompts-match">
      <header className="head">
        <div>
          <p className="sub">Assemble a ready-to-paste prompt from your files.</p>
          <h1>Agent prompts</h1>
        </div>
        <fieldset className="seg" aria-label="Prompt style">
          {(["Implement", "Review", "Plan"] as const).map((option) => (
            <button
              type="button"
              key={option}
              className={style === option ? "on" : ""}
              onClick={() => setStyle(option)}
            >
              {option}
            </button>
          ))}
        </fieldset>
      </header>
      <div className="two">
        <section className="pk">
          <b>Tasks</b>
          <div className="prompt-records">
            {tasks.map((task) => (
              <label key={task.id}>
                <input
                  type="checkbox"
                  checked={selectedTasks.includes(task.id)}
                  onChange={(event) =>
                    setSelectedTasks((current) =>
                      event.target.checked
                        ? [...current, task.id]
                        : current.filter((id) => id !== task.id),
                    )
                  }
                />
                <span>
                  {task.id} · {task.name}
                </span>
              </label>
            ))}
          </div>
          <br />
          <b>Context documents</b>
          <div className="prompt-records">
            {documents.map((document) => (
              <label key={document.id}>
                <input
                  type="checkbox"
                  checked={selectedDocuments.includes(document.id)}
                  onChange={(event) =>
                    setSelectedDocuments((current) =>
                      event.target.checked
                        ? [...current, document.id]
                        : current.filter((id) => id !== document.id),
                    )
                  }
                />
                <span>{document.name}</span>
              </label>
            ))}
          </div>
        </section>
        <section>
          <div className="dh2">
            <small className="sub">
              {wordCount} words · {Math.max(1, Math.round(wordCount / 200))} min read
            </small>
            <span className="gap" />
            <Button className="btn2 pr" disabled={!contextReady} onClick={() => void copyPrompt()}>
              <Copy className="size-4" /> Copy prompt
            </Button>
          </div>
          <pre className="pp">{prompt}</pre>
        </section>
      </div>
    </div>
  );
}
