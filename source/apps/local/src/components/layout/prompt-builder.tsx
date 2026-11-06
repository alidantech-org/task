"use client";

import { Button } from "@task/ui";
import { Copy, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckBox } from "@/components/ui/checkbox";

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

function PickerGroup({
  title,
  items,
  selected,
  onChange,
  detail,
}: {
  title: string;
  items: readonly PromptRecord[];
  selected: string[];
  onChange(next: string[]): void;
  detail(record: PromptRecord): string;
}) {
  const ids = items.map((item) => item.id);
  const count = ids.filter((id) => selected.includes(id)).length;
  const all = count === ids.length;
  return (
    <div className="pk-group">
      <div className="pk-head">
        <CheckBox
          label={`Select all in ${title}`}
          checked={all ? true : count > 0 ? "indeterminate" : false}
          onCheckedChange={(next) =>
            onChange(
              next
                ? [...new Set([...selected, ...ids])]
                : selected.filter((id) => !ids.includes(id)),
            )
          }
        />
        <b>{title}</b>
        <small>
          {count}/{ids.length}
        </small>
      </div>
      {items.map((item) => (
        <div className="pk-item" key={item.id}>
          <CheckBox
            label={item.name}
            checked={selected.includes(item.id)}
            onCheckedChange={(next) =>
              onChange(next ? [...selected, item.id] : selected.filter((id) => id !== item.id))
            }
          />
          <span>
            {item.name}
            <small>{detail(item)}</small>
          </span>
        </div>
      ))}
    </div>
  );
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
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [style, setStyle] = useState<PromptStyle>("Implement");
  const [bodies, setBodies] = useState<Record<string, PromptBody>>({});
  const bodiesRef = useRef(bodies);
  bodiesRef.current = bodies;

  const tasks = records.filter(
    (record) =>
      record.type === "task" && record.status !== "completed" && record.status !== "archived",
  );
  const documents = records.filter((record) => record.type !== "task");
  const needle = search.trim().toLocaleLowerCase();
  const matches = (record: PromptRecord) =>
    !needle || `${record.id} ${record.name} ${record.path}`.toLocaleLowerCase().includes(needle);
  const statusOrder = ["in-progress", "blocked", "planned"];
  const taskSections = statusOrder
    .map(
      (status) =>
        [
          status,
          tasks.filter((task) => (task.status ?? "planned") === status && matches(task)),
        ] as const,
    )
    .filter(([, items]) => items.length > 0);
  const documentGroups = new Map<string, PromptRecord[]>();
  for (const record of documents.filter(matches)) {
    const folder = record.path.split("/")[0] ?? "Files";
    documentGroups.set(folder, [...(documentGroups.get(folder) ?? []), record]);
  }
  const documentSections = [...documentGroups].sort(([left], [right]) => left.localeCompare(right));
  const selectedRecords = useMemo(
    () =>
      records.filter(
        (record) => selectedTasks.includes(record.id) || selectedDocuments.includes(record.id),
      ),
    [records, selectedDocuments, selectedTasks],
  );
  const selectionKey = `${selectedTasks.join("\u0000")}\u0001${selectedDocuments.join("\u0000")}`;

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
          <label className="pk-search">
            <Search className="size-4" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks and documents"
              aria-label="Search tasks and documents"
            />
          </label>
          <div className="pk-quick">
            <button
              type="button"
              onClick={() =>
                setSelectedTasks(
                  tasks.filter((task) => task.status === "in-progress").map((task) => task.id),
                )
              }
            >
              Select in progress
            </button>
            <button
              type="button"
              disabled={selectedTasks.length + selectedDocuments.length === 0}
              onClick={() => {
                setSelectedTasks([]);
                setSelectedDocuments([]);
              }}
            >
              Clear selection
            </button>
          </div>
          {selectedRecords.length > 0 && (
            <div className="pk-chosen">
              {selectedRecords.map((record) => (
                <span key={record.id}>
                  {record.type === "task" ? record.id : record.name}
                  <button
                    type="button"
                    aria-label={`Remove ${record.name}`}
                    onClick={() => {
                      setSelectedTasks((current) => current.filter((id) => id !== record.id));
                      setSelectedDocuments((current) => current.filter((id) => id !== record.id));
                    }}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {taskSections.map(([status, items]) => (
            <PickerGroup
              key={status}
              title={statusLabel(status)}
              items={items}
              selected={selectedTasks}
              onChange={setSelectedTasks}
              detail={(task) => task.id}
            />
          ))}
          {documentSections.map(([folder, items]) => (
            <PickerGroup
              key={folder}
              title={folder}
              items={items}
              selected={selectedDocuments}
              onChange={setSelectedDocuments}
              detail={(document) => document.path}
            />
          ))}
          {taskSections.length + documentSections.length === 0 && (
            <p className="sub">Nothing matches “{search}”.</p>
          )}
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
