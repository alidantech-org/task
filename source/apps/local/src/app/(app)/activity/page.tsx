import { ActivityPage as ActivityContent } from "@/components/pages/activity-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Task — Activity" };
export default function ActivityPage() {
  return <ActivityContent />;
}
