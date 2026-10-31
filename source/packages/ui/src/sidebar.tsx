import { cn } from "@task/ui/utils.ts";
import type { HTMLAttributes, JSX } from "react";

export function Sidebar({ className, ...props }: HTMLAttributes<HTMLElement>): JSX.Element {
  return (
    <aside
      data-slot="sidebar"
      className={cn("min-h-full border-r bg-background text-foreground", className)}
      {...props}
    />
  );
}

export function SidebarGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div data-slot="sidebar-group" className={cn("space-y-1", className)} {...props} />;
}

export function SidebarGroupLabel({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  return (
    <p
      data-slot="sidebar-group-label"
      className={cn(
        "px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
