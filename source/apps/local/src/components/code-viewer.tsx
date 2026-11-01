"use client";

import { parseUnifiedDiff } from "@task/workspace/diff/parse";
import { Check, Copy } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { type HighlightedToken, highlightLines } from "@/lib/highlight";

const maxHighlightedCharacters = 200_000;

function useHighlightedLines(code: string, language: string): HighlightedToken[][] | null {
  const [lines, setLines] = useState<HighlightedToken[][] | null>(null);
  useEffect(() => {
    let active = true;
    setLines(null);
    if (language === "text" || code.length > maxHighlightedCharacters) return;
    void highlightLines(code, language)
      .then((result) => {
        if (active) setLines(result);
      })
      .catch(() => {
        if (active) setLines(null);
      });
    return () => {
      active = false;
    };
  }, [code, language]);
  return lines;
}

function Tokens({ tokens, fallback }: { tokens?: HighlightedToken[]; fallback: string }) {
  if (!tokens) return <>{fallback || " "}</>;
  return (
    <>
      {tokens.map((token, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional and never reordered
          key={index}
          className="code-token"
          style={
            {
              "--code-light": token.light,
              "--code-dark": token.dark,
              fontStyle: token.italic ? "italic" : undefined,
            } as CSSProperties
          }
        >
          {token.content}
        </span>
      ))}
      {tokens.length === 0 ? " " : null}
    </>
  );
}

type CodeViewerProps = {
  code: string;
  language: string;
  startLine?: number;
  highlightFrom?: number;
  highlightTo?: number;
  compact?: boolean;
  showLineNumbers?: boolean;
};

export function CodeViewer({
  code,
  language,
  startLine = 1,
  highlightFrom,
  highlightTo,
  compact = false,
  showLineNumbers = !compact,
}: CodeViewerProps) {
  const tokens = useHighlightedLines(code, language);
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  useEffect(() => {
    if (highlightFrom === undefined) return;
    document.getElementById(`L${highlightFrom}`)?.scrollIntoView({ block: "center" });
  }, [highlightFrom]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className={`code-viewer ${compact ? "compact" : ""}`}>
      <div className="code-viewer-bar">
        <span>{language}</span>
        <button type="button" onClick={() => void copy()} aria-label="Copy code">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="code-viewer-body">
        {lines.map((text, index) => {
          const number = startLine + index;
          const highlighted =
            highlightFrom !== undefined &&
            number >= highlightFrom &&
            number <= (highlightTo ?? highlightFrom);
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional and never reordered
              key={index}
              id={`L${number}`}
              className={`code-line ${highlighted ? "hl" : ""}`}
            >
              {showLineNumbers && <span className="code-ln">{number}</span>}
              <code>
                <Tokens tokens={tokens?.[index]} fallback={text} />
              </code>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DiffViewer({ diff, language }: { diff: string; language: string }) {
  const files = parseUnifiedDiff(diff);
  return (
    <div className="diff-viewer">
      {files.map((file) => (
        <div key={`${file.oldPath}->${file.newPath}`}>
          {file.binary && <p className="sub">Binary file changed</p>}
          {file.hunks.map((hunk) => (
            <DiffHunkView key={hunk.header} hunk={hunk} language={language} />
          ))}
        </div>
      ))}
      {files.length === 0 && <p className="sub">No textual changes.</p>}
    </div>
  );
}

function DiffHunkView({
  hunk,
  language,
}: {
  hunk: ReturnType<typeof parseUnifiedDiff>[number]["hunks"][number];
  language: string;
}) {
  const tokens = useHighlightedLines(hunk.lines.map((line) => line.text).join("\n"), language);
  return (
    <div className="code-viewer-body diff-hunk">
      <div className="diff-hunk-header">{hunk.header}</div>
      {hunk.lines.map((line, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional and never reordered
          key={index}
          className={`code-line diff-${line.type}`}
        >
          <span className="code-ln">{line.oldLine ?? ""}</span>
          <span className="code-ln">{line.newLine ?? ""}</span>
          <span className="diff-marker">
            {line.type === "add" ? "+" : line.type === "delete" ? "-" : " "}
          </span>
          <code>
            <Tokens tokens={tokens?.[index]} fallback={line.text} />
          </code>
        </div>
      ))}
    </div>
  );
}
