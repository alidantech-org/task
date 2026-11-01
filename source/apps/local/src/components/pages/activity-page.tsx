"use client";

import { Activity } from "lucide-react";
import { useWorkspaceApp } from "@/components/layout/app-layout";

export function ActivityPage() {
  const { records, openRecord } = useWorkspaceApp();
  const recent = [...records]
    .sort((left, right) => right.modifiedAt - left.modifiedAt)
    .slice(0, 50);
  return (
    <div>
      <header>
        <p className="text-sm text-muted-foreground">Everything that changed in this workspace.</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Activity</h1>
      </header>
      <div className="mt-6 divide-y rounded-2xl border bg-card">
        {recent.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openRecord(item)}
            className="flex w-full items-center gap-3 p-4 text-left hover:bg-soft/50"
          >
            <Activity className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(item.modifiedAt).toLocaleString()}
            </span>
          </button>
        ))}
        {recent.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No workspace changes yet.</p>
        )}
      </div>
    </div>
  );
}
