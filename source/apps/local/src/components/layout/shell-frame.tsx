import type { ReactNode } from "react";

type AppLayoutProps = {
  children: ReactNode;
  sidebarMode: "full" | "mini" | "hidden";
  sidebarWidth: number;
};

export function ShellFrame({ children, sidebarMode, sidebarWidth }: AppLayoutProps) {
  return (
    <div
      data-slot="task-app-shell"
      data-sidebar-mode={sidebarMode}
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
