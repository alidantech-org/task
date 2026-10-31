import Link from "next/link";
import type { ReactNode } from "react";

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Task home">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-semibold">T</span>
            </span>
            <span className="text-base font-semibold tracking-tight">Task</span>
          </Link>
          <span className="text-sm text-muted-foreground">Work, made clear</span>
        </div>
      </header>
      {children}
    </div>
  );
}
