const byExtension: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "jsonc",
  md: "markdown",
  mdx: "mdx",
  css: "css",
  scss: "scss",
  html: "html",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  py: "python",
  rs: "rust",
  go: "go",
  dart: "dart",
  sql: "sql",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  rb: "ruby",
  php: "php",
  c: "c",
  h: "c",
  cpp: "cpp",
  cs: "csharp",
  vue: "vue",
  svelte: "svelte",
  xml: "xml",
  svg: "xml",
  graphql: "graphql",
  hbs: "handlebars",
  diff: "diff",
  patch: "diff",
};
const byName: Record<string, string> = {
  dockerfile: "docker",
  makefile: "makefile",
  ".gitignore": "ini",
  ".editorconfig": "ini",
};

/** Maps a file path to a Shiki language id; unknown files are plain text. */
export function languageForPath(path: string): string {
  const name = (path.split("/").pop() ?? "").toLowerCase();
  if (byName[name]) return byName[name];
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? (byExtension[name.slice(dot + 1)] ?? "text") : "text";
}
