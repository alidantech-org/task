import { parseChecklist } from "@task/workspace/documents/checklist";
import type { QualityMode, WorkspaceConfig } from "@task/workspace/indexing/types";

export type QualityFindingCode =
  | "too_short"
  | "missing_section"
  | "empty_heading"
  | "placeholder_text"
  | "too_few_checkboxes"
  | "missing_goal_doc"
  | "missing_plan_doc";

export type QualityFinding = { code: QualityFindingCode; message: string };

export type ResolvedQuality = {
  mode: QualityMode;
  minTaskWords: number;
  minChecklistItems: number;
  minGroupDocWords: number;
};

export const defaultQuality: ResolvedQuality = {
  mode: "reject",
  minTaskWords: 150,
  minChecklistItems: 3,
  minGroupDocWords: 100,
};

export function resolveQuality(config?: WorkspaceConfig): ResolvedQuality {
  return { ...defaultQuality, ...(config?.quality ?? {}) };
}

const goalHeading = /^(goal|goals|context|purpose|background|objective|objectives|why)\b/i;
const acceptanceHeading =
  /^(acceptance|acceptance criteria|checklist|done when|definition of done|steps|deliverables)\b/i;
const placeholder =
  /\b(todo|tbd|fixme|lorem ipsum|to be written|to be defined|describe here|fill (?:this|me) in|placeholder)\b/i;
const fence = /^\s*(```|~~~)/;
const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

type Section = { title: string; level: number; content: string[] };

function proseLines(body: string): string[] {
  const withoutComments = body.replace(/<!--[\s\S]*?-->/g, "");
  const lines: string[] = [];
  let open: string | undefined;
  for (const line of withoutComments.split("\n")) {
    const marker = fence.exec(line)?.[1];
    if (marker) {
      open = open === undefined ? marker : open === marker ? undefined : open;
      continue;
    }
    if (!open) lines.push(line);
  }
  return lines;
}

function sections(body: string): Section[] {
  const found: Section[] = [];
  let current: Section | undefined;
  for (const line of proseLines(body)) {
    const match = heading.exec(line);
    if (match?.[1] && match[2]) {
      current = { title: match[2], level: match[1].length, content: [] };
      found.push(current);
    } else if (current && line.trim()) current.content.push(line);
  }
  return found;
}

export function countWords(body: string): number {
  const text = proseLines(body)
    .filter((line) => !heading.test(line))
    .join("\n")
    .replace(/\[([ xX])\]/g, " ");
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
}

function sharedFindings(body: string, minWords: number, label: string): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const words = countWords(body);
  if (words < minWords)
    findings.push({
      code: "too_short",
      message: `${label} has ${words} words; at least ${minWords} are required. Explain the real purpose, context and expected result in full sentences.`,
    });
  const all = sections(body);
  for (const [index, section] of all.entries()) {
    const next = all[index + 1];
    const hasChildren = next !== undefined && next.level > section.level;
    if (section.content.length === 0 && !hasChildren)
      findings.push({
        code: "empty_heading",
        message: `${label}: the section "${section.title}" is empty. Fill it in or remove it.`,
      });
  }
  const leftover = proseLines(body).find((line) => placeholder.test(line));
  if (leftover)
    findings.push({
      code: "placeholder_text",
      message: `${label} still contains placeholder text ("${leftover.trim().slice(0, 60)}"). Replace it with real content.`,
    });
  return findings;
}

/** Findings that stop a scaffold-only or thin task from leaving `planned`. */
export function assessTaskBody(body: string, quality: ResolvedQuality): QualityFinding[] {
  const findings = sharedFindings(body, quality.minTaskWords, "The task");
  const all = sections(body);
  const withContent = (pattern: RegExp) =>
    all.some((section) => pattern.test(section.title.trim()) && section.content.length > 0);
  if (!withContent(goalHeading))
    findings.push({
      code: "missing_section",
      message:
        'The task needs a filled "Goal" (or Context, Purpose, Background) section describing why the work matters and the outcome.',
    });
  if (!withContent(acceptanceHeading))
    findings.push({
      code: "missing_section",
      message:
        'The task needs a filled "Acceptance checklist" (or Checklist, Done when, Steps) section.',
    });
  const boxes = parseChecklist(body).total;
  if (boxes < quality.minChecklistItems)
    findings.push({
      code: "too_few_checkboxes",
      message: `The task has ${boxes} checkbox item(s); at least ${quality.minChecklistItems} are required. Break the work into concrete "- [ ]" steps inside this one file instead of creating more files.`,
    });
  return findings;
}

/** Findings for a group's goal.md or plan.md. */
export function assessGroupDocBody(
  body: string,
  quality: ResolvedQuality,
  label: string,
): QualityFinding[] {
  return sharedFindings(body, quality.minGroupDocWords, label);
}

export function formatFindings(subject: string, findings: readonly QualityFinding[]): string {
  const lines = findings.map((finding) => `  - ${finding.message}`);
  return `${subject} is not detailed enough to proceed:\n${lines.join("\n")}\nWrite the missing content with "task edit <id>" (or pass --body-file when creating), then try again. Policy is configured under quality in task.yaml.`;
}
