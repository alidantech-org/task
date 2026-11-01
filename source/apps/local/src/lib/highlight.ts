import { type BundledLanguage, bundledLanguages, createHighlighter } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export type HighlightedToken = { content: string; light?: string; dark?: string; italic: boolean };

type Highlighter = Awaited<ReturnType<typeof createHighlighter>>;

const themes = { light: "github-light", dark: "github-dark" } as const;
let highlighter: Promise<Highlighter> | undefined;

function getHighlighter(): Promise<Highlighter> {
  highlighter ??= createHighlighter({
    themes: [themes.light, themes.dark],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

/** Highlights code into per-line tokens carrying light and dark colours; unknown languages stay plain. */
export async function highlightLines(
  code: string,
  language: string,
): Promise<HighlightedToken[][]> {
  const engine = await getHighlighter();
  let lang: BundledLanguage | "text" = "text";
  if (language in bundledLanguages) {
    try {
      await engine.loadLanguage(language as BundledLanguage);
      lang = language as BundledLanguage;
    } catch {
      lang = "text";
    }
  }
  return engine.codeToTokensWithThemes(code, { lang, themes }).map((line) =>
    line.map((token) => ({
      content: token.content,
      light: token.variants.light?.color,
      dark: token.variants.dark?.color,
      italic: Boolean((token.variants.light?.fontStyle ?? 0) & 1),
    })),
  );
}
