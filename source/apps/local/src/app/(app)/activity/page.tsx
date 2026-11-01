import type { Metadata } from "next";
import { ActivityPage as ActivityContent } from "@/components/pages/activity-page";

export const metadata: Metadata = { title: "Task — Activity" };
export default function ActivityPage() {
  return <ActivityContent />;
}
