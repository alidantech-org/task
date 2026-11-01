import { HealthPage as HealthContent } from "@/components/pages/health-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Task — Workspace health" };
export default function HealthPage() {
  return <HealthContent />;
}
