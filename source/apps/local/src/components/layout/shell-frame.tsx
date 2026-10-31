import type { ReactNode, PointerEventHandler } from "react";

type AppLayoutProps = {
  children: ReactNode;
  onPointerDownCapture: PointerEventHandler<HTMLDivElement>;
};

export function ShellFrame({ children, onPointerDownCapture }: AppLayoutProps) {
  return (
    <div
      data-slot="task-app-shell"
      onPointerDownCapture={onPointerDownCapture}
      className="relative flex h-svh w-full min-w-0 overflow-hidden bg-muted/40 text-foreground"
    >
      {children}
    </div>
  );
}
