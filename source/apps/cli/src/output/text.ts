const combining =
  /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f\ufe0e\ufe0f]/u;
const wide =
  /[\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6\u{1f000}-\u{1faff}\u{20000}-\u{3fffd}]/u;

export function displayWidth(value: string): number {
  let width = 0;
  for (const character of value) {
    if (combining.test(character)) continue;
    width += wide.test(character) ? 2 : 1;
  }
  return width;
}

export function truncate(value: string, maxWidth: number, marker = "…"): string {
  if (displayWidth(value) <= maxWidth) return value;
  const markerWidth = displayWidth(marker);
  if (maxWidth <= markerWidth) return marker.slice(0, maxWidth);
  let result = "";
  let width = 0;
  for (const character of value) {
    const next = displayWidth(character);
    if (width + next + markerWidth > maxWidth) break;
    result += character;
    width += next;
  }
  return `${result}${marker}`;
}

export function terminalWidth(env: Record<string, string | undefined>, columns?: number): number {
  const reported = columns ?? Number(env.COLUMNS);
  if (!Number.isFinite(reported) || reported <= 0) return 80;
  return Math.min(Math.floor(reported), 120);
}
