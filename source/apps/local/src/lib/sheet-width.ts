export const defaultSheetWidth = 580;
export const minSheetWidth = 420;
/** Dragging narrower than this and releasing hides the sheet. */
export const hideBelowWidth = 380;
/** The narrowest the sheet is drawn while dragging, so it never disappears under the pointer. */
const dragFloor = 280;
const viewportMargin = 24;
export const wideSheetWidth = 1120;

export type SheetResize = { width: number; hide: boolean };

/** Turns the pointer's distance from the right edge into a sheet width and a hide-on-release decision. */
export function resolveSheetWidth(requested: number, viewportWidth: number): SheetResize {
  const max = Math.max(minSheetWidth, viewportWidth - viewportMargin);
  if (requested < hideBelowWidth) return { width: Math.max(dragFloor, requested), hide: true };
  return { width: Math.min(max, Math.max(minSheetWidth, requested)), hide: false };
}

export function clampStoredWidth(value: unknown, viewportWidth: number): number {
  const parsed = typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < minSheetWidth) return defaultSheetWidth;
  return resolveSheetWidth(parsed, viewportWidth).width;
}
