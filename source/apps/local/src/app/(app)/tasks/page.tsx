import type { Metadata } from "next";
import { TasksPageContent } from "@/components/pages/tasks-page";

export const metadata: Metadata = { title: "Task — Tasks" };
export default function TasksPage() {
  return <TasksPageContent />;
}
