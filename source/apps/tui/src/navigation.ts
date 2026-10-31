export const navigationSections = [
  "Tasks",
  "Groups",
  "Docs",
  "Rules",
  "Agents",
  "Activity",
] as const;

export type NavigationSection = (typeof navigationSections)[number];

export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return (index + length) % length;
}

export function clampIndex(index: number, length: number): number {
  return length <= 0 ? 0 : Math.max(0, Math.min(index, length - 1));
}
