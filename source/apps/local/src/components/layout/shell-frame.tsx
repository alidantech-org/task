import type { PointerEventHandler, ReactNode } from "react";

type AppLayoutProps = {
  children: ReactNode;
  onPointerDownCapture: PointerEventHandler<HTMLDivElement>;
  sidebarMode: "full" | "mini" | "hidden";
  sidebarWidth: number;
};

export function ShellFrame({
  children,
  onPointerDownCapture,
  sidebarMode,
  sidebarWidth,
}: AppLayoutProps) {
  return (
    <div
      data-slot="task-app-shell"
      data-sidebar-mode={sidebarMode}
      onPointerDownCapture={onPointerDownCapture}
      style={
        {
          "--sw":
            sidebarMode === "hidden"
              ? "0px"
              : sidebarMode === "mini"
                ? "68px"
                : `${sidebarWidth}px`,
        } as React.CSSProperties
      }
      className={`shell ${sidebarMode === "hidden" ? "hid" : sidebarMode === "mini" ? "msb" : ""}`}
    >
      {children}
    </div>
  );
}
