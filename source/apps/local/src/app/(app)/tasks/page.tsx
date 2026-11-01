import { TasksPageContent } from "@/components/pages/tasks-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Task — Tasks" };
export default function TasksPage() {
  return <TasksPageContent />;
}
