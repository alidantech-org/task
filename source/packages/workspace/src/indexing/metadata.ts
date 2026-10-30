import type { DocumentMetadata } from "@task/workspace/indexing/types";

export function hashContent(content: string): string {
  return new Bun.CryptoHasher("sha256").update(content).digest("hex");
}

export function parseMetadata(content: string): DocumentMetadata {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) throw new Error("Missing YAML frontmatter block");
  const parsed = Bun.YAML.parse(match[1]);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Frontmatter must be a YAML mapping");
  }
  const values = parsed as Record<string, unknown>;
  const scalar = (key: string): string | undefined =>
    typeof values[key] === "string" || typeof values[key] === "number"
      ? String(values[key])
      : undefined;
  const id = scalar("id");
  const name = scalar("name");
  const type = scalar("type");
  if (!id || !name || !type) throw new Error("Frontmatter requires non-empty id, name, and type");
  const rawTags = values.tags ?? [];
  if (!Array.isArray(rawTags) || rawTags.some((tag) => typeof tag !== "string")) {
    throw new Error("Tags must be a YAML string sequence");
  }
  const tags = rawTags as string[];
  if (new Set(tags).size !== tags.length) throw new Error("Tags must not contain duplicates");
  if (tags.some((tag) => !tag)) throw new Error("Tags must be non-empty strings");
  const dates: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (
      /(date|at|until|due)$/i.test(key) &&
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      dates[key] = value;
    }
  }
  return {
    id,
    name,
    type,
    tags,
    ...(scalar("status") ? { status: scalar("status") } : {}),
    dates,
  };
}
