/**
 * Pure, fence-aware checklist parsing shared by the CLI, runtime and dashboard. Checkbox lines are
 * numbered in document order (0-based) and grouped under the nearest preceding heading.
 */
export type ChecklistItem = { index: number; text: string; checked: boolean; line: number };
export type ChecklistGroup = {
  heading: string;
  level: number;
  line: number;
  items: ChecklistItem[];
};
export type Checklist = {
  groups: ChecklistGroup[];
  items: ChecklistItem[];
  total: number;
  completed: number;
};
export type ChecklistSelector = {
  /** 0-based indexes in document order. */
  items?: readonly number[];
  /** Heading title, matched case-insensitively. */
  section?: string;
  all?: boolean;
};

const checkboxLine = /^(\s*(?:[-+*]|\d+[.)])\s+\[)([ xX])(\]\s+)(.*)$/;
const headingLine = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const fenceLine = /^\s*(```|~~~)/;

type Scanned =
  | { kind: "heading"; line: number; level: number; title: string }
  | { kind: "checkbox"; line: number; checked: boolean; text: string };

function scan(lines: readonly string[]): Scanned[] {
  const found: Scanned[] = [];
  let fence: string | undefined;
  for (const [line, text] of lines.entries()) {
    const marker = fenceLine.exec(text)?.[1];
    if (marker) {
      fence = fence === undefined ? marker : fence === marker ? undefined : fence;
      continue;
    }
    if (fence) continue;
    const heading = headingLine.exec(text);
    if (heading?.[1] && heading[2]) {
      found.push({ kind: "heading", line, level: heading[1].length, title: heading[2] });
      continue;
    }
    const box = checkboxLine.exec(text);
    if (box) found.push({ kind: "checkbox", line, checked: box[2] !== " ", text: box[4] ?? "" });
  }
  return found;
}

export function parseChecklist(body: string): Checklist {
  const groups: ChecklistGroup[] = [];
  const items: ChecklistItem[] = [];
  let current: ChecklistGroup | undefined;
  for (const entry of scan(body.split("\n"))) {
    if (entry.kind === "heading") {
      current = { heading: entry.title, level: entry.level, line: entry.line, items: [] };
      groups.push(current);
      continue;
    }
    if (!current) {
      current = { heading: "", level: 0, line: 0, items: [] };
      groups.push(current);
    }
    const item = {
      index: items.length,
      text: entry.text,
      checked: entry.checked,
      line: entry.line,
    };
    items.push(item);
    current.items.push(item);
  }
  return {
    groups: groups.filter((group) => group.items.length > 0),
    items,
    total: items.length,
    completed: items.filter((item) => item.checked).length,
  };
}

export function checklistProgress(body: string): { completed: number; total: number } {
  const { completed, total } = parseChecklist(body);
  return { completed, total };
}

/** Sets the selected checkboxes and reports how many lines actually changed. */
export function setChecklistItems(
  body: string,
  selector: ChecklistSelector,
  checked: boolean,
): { body: string; changed: number; selected: number } {
  const checklist = parseChecklist(body);
  let targets: ChecklistItem[];
  if (selector.all) targets = checklist.items;
  else if (selector.section !== undefined) {
    const wanted = selector.section.trim().toLowerCase();
    const groups = checklist.groups.filter(
      (group) => group.heading.trim().toLowerCase() === wanted,
    );
    if (groups.length === 0) throw new Error(`No checklist section named "${selector.section}"`);
    targets = groups.flatMap((group) => group.items);
  } else if (selector.items) {
    targets = selector.items.map((index) => {
      const item = checklist.items[index];
      if (!item) throw new Error(`No checklist item ${index + 1}`);
      return item;
    });
  } else throw new Error("Select checklist items, a section or all");
  const lines = body.split("\n");
  let changed = 0;
  for (const item of new Set(targets)) {
    const match = checkboxLine.exec(lines[item.line] ?? "");
    if (!match || (match[2] !== " ") === checked) continue;
    lines[item.line] = `${match[1]}${checked ? "x" : " "}${match[3]}${match[4]}`;
    changed += 1;
  }
  return { body: lines.join("\n"), changed, selected: targets.length };
}
