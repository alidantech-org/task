"use client";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@task/ui";
import { useState } from "react";

type PromptRecord = { path: string; id: string; name: string };
type PromptWorkspace = { projectRoot: string } | null;

export function PromptBuilder({
  records,
  workspace,
  setNotice,
}: {
  records: PromptRecord[];
  workspace: PromptWorkspace;
  setNotice(message: string): void;
}) {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  function generate() {
    const selected = records.filter((item) => selectedPaths.includes(item.path));
    const paths = selected
      .map((item) => `- ${item.id} — ${item.name}\n Path: ${item.path}`)
      .join("\n");
    setPrompt(
      `You are working in the Task project at ${workspace?.projectRoot ?? "<project-root>"}.\n\nUse Task CLI commands (task or tk) to inspect or update managed files. Read the referenced files first and validate changes with task validate.\n\nSelected context:\n${paths || "- No files selected"}\n\nPlease review the repository and complete the requested work. Summarize changed files and verification performed.`,
    );
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Prepare reviewed workspace context for an agent.
      </p>
      <h1 className="mt-1 text-3xl font-semibold">Agent prompt builder</h1>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Select records</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[60svh] space-y-2 overflow-auto">
            {records.map((item) => (
              <label
                key={item.path}
                className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selectedPaths.includes(item.path)}
                  onChange={(event) =>
                    setSelectedPaths((current) =>
                      event.target.checked
                        ? [...current, item.path]
                        : current.filter((path) => path !== item.path),
                    )
                  }
                />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.id}</span>
              </label>
            ))}
            <Button onClick={generate}>Generate prompt</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Review prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-72 w-full rounded-xl border bg-background p-3 font-mono text-xs"
              placeholder="Generate a prompt to review it here."
            />
            <div className="mt-3 flex gap-2">
              <Button
                disabled={!prompt}
                onClick={() => {
                  void navigator.clipboard.writeText(prompt);
                  setNotice("Prompt copied");
                }}
              >
                Copy prompt
              </Button>
              <Button
                variant="outline"
                disabled={!prompt}
                onClick={() => {
                  void navigator.clipboard.writeText(prompt);
                  window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
                }}
              >
                Open ChatGPT
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
