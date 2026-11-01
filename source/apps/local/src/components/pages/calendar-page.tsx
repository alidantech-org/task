"use client";

import { useSearchParams } from "next/navigation";
import { CalendarView } from "@/components/calendar";
import { useWorkspaceApp } from "@/components/layout/app-layout";

export function CalendarPage() {
  const searchParams = useSearchParams();
  const { tasks, allTasks, openCreate, openRecord } = useWorkspaceApp();
  const scheduled = tasks.filter((task) => task.status !== "archived");
  return (
    <div className="calendar-page-match">
      <CalendarView
        tasks={scheduled}
        initialDate={searchParams.get("date") ?? undefined}
        onCreate={openCreate}
        onSelect={(task) => openRecord(allTasks.find((item) => item.id === task.id) ?? null)}
      />
    </div>
  );
}
