export function restartSectionEntrance(body: HTMLElement | null): void {
  if (!body) return;
  body.classList.remove("enter");
  // Force a layout pass so the entrance animation can restart on view changes.
  void body.offsetWidth;
  body.classList.add("enter");
}
