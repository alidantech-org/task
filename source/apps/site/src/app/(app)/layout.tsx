import Link from "next/link";
import type { ReactNode } from "react";

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Taskcode home">
            <svg
              aria-hidden="true"
              viewBox="0 0 270 48"
              fill="none"
              className="h-9 w-[203px] text-primary"
            >
              <path
                d="M24 4.5a19.5 19.5 0 1 0 0 39 19.5 19.5 0 0 0 0-39Z"
                stroke="#3454F5"
                strokeWidth="2.5"
              />
              <path
                d="m19 16-5.5 8 5.5 8m10-16 5.5 8-5.5 8"
                stroke="#3454F5"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="m20.5 24.5 2.5 2.5 5-6"
                stroke="#3454F5"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <text
                x="56"
                y="41"
                fill="var(--foreground)"
                fontFamily="var(--font-heading), sans-serif"
                fontSize="48"
                fontWeight="700"
                letterSpacing="-1.5"
              >
                Task
              </text>
              <text
                x="154"
                y="41"
                fill="#3454F5"
                fontFamily="var(--font-heading), sans-serif"
                fontSize="48"
                fontWeight="700"
                letterSpacing="-1.5"
              >
                code
              </text>
            </svg>
          </Link>
          <span className="text-sm text-muted-foreground">Work, made clear</span>
        </div>
      </header>
      {children}
    </div>
  );
}
