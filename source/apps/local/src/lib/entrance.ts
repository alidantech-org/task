export function restartSectionEntrance(body: HTMLElement | null): void {
  if (!body) return;
  body.classList.remove("enter");
  const animated = body.querySelectorAll<HTMLElement>(".box,.stat2,.hero2,.unp,.wk7,.day,.col");
  animated.forEach((element, index) => {
    element.style.setProperty("--i", String(Math.min(index, 14)));
  });
  // Force a layout pass so the entrance animation can restart on view changes.
  void body.offsetWidth;
  body.classList.add("enter");
}
