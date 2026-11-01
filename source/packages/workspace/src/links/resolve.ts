function normalize(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length && parts[parts.length - 1] !== "..") parts.pop();
      else parts.push("..");
    } else parts.push(part);
  }
  return parts.join("/") || ".";
}

function directoryOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "." : path.slice(0, index);
}

export type LinkTarget =
  | { kind: "external"; href: string }
  | { kind: "anchor"; anchor: string }
  | { kind: "document"; id: string; anchor?: string }
  | { kind: "file"; path: string; startLine?: number; endLine?: number }
  | { kind: "blocked"; href: string };

export type LinkContext = {
  /** Workspace-relative path of the document containing the link. */
  fromPath: string;
  /** Workspace directory relative to the project root, for example "tasks" (or "." for the root). */
  workspacePrefix: string;
  documents: readonly { id: string; path: string }[];
};

const idPattern = /^(TSK|GRP|DOC|DEC)-[A-Z0-9-]+$/i;
const safeSchemes = new Set(["http:", "https:", "mailto:"]);

function parseLines(suffix: string): { startLine?: number; endLine?: number } {
  const match = /^#?L(\d+)(?:-L?(\d+))?$/i.exec(suffix) ?? /^:(\d+)(?:-(\d+))?$/.exec(suffix);
  if (!match) return {};
  const startLine = Number(match[1]);
  const endLine = match[2] ? Number(match[2]) : undefined;
  return endLine && endLine >= startLine ? { startLine, endLine } : { startLine };
}

/**
 * Classifies a Markdown link so the dashboard (and other clients) can open documents by id, project
 * files in the file viewer, and external links safely.
 */
export function resolveLink(href: string, context: LinkContext): LinkTarget {
  const value = href.trim();
  if (!value) return { kind: "blocked", href };
  if (value.startsWith("#")) return { kind: "anchor", anchor: value.slice(1) };
  const scheme = /^([a-z][a-z0-9+.-]*:)/i.exec(value);
  if (scheme?.[1]) {
    return safeSchemes.has(scheme[1].toLowerCase())
      ? { kind: "external", href: value }
      : { kind: "blocked", href };
  }
  if (value.startsWith("//")) return { kind: "blocked", href };
  const [beforeHash = "", hash = ""] = value.split(/#(.*)/s).slice(0, 2);
  const idOnly = decodeURIComponent(beforeHash);
  if (idPattern.test(idOnly) || context.documents.some((document) => document.id === idOnly))
    return { kind: "document", id: idOnly, ...(hash ? { anchor: hash } : {}) };
  let target = beforeHash.split("?")[0] ?? "";
  let lines = parseLines(hash ? `#${hash}` : "");
  const colonLines = /^(.*?)(:\d+(?:-\d+)?)$/.exec(target);
  if (colonLines?.[1] && colonLines[2]) {
    target = colonLines[1];
    lines = parseLines(colonLines[2]);
  }
  try {
    target = decodeURIComponent(target);
  } catch {
    return { kind: "blocked", href };
  }
  if (!target || target.includes("\0")) return { kind: "blocked", href };
  const fromDirectory = `${context.workspacePrefix}/${directoryOf(context.fromPath)}`;
  const projectPath = normalize(
    target.startsWith("/") ? target.slice(1) : `${fromDirectory}/${target}`,
  );
  if (projectPath === ".." || projectPath.startsWith("../")) return { kind: "blocked", href };
  const prefix = context.workspacePrefix === "." ? "" : `${context.workspacePrefix}/`;
  if (projectPath.startsWith(prefix)) {
    const workspacePath = projectPath.slice(prefix.length);
    const document = context.documents.find((candidate) => candidate.path === workspacePath);
    if (document) return { kind: "document", id: document.id, ...(hash ? { anchor: hash } : {}) };
  }
  return { kind: "file", path: projectPath, ...lines };
}
