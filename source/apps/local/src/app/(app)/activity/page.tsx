import type { Metadata } from "next";
import { ActivityPage as ActivityContent } from "@/components/pages/activity-page";

export const metadata: Metadata = { title: "Taskcode — Activity" };
export default function ActivityPage() {
  return <ActivityContent />;
}
