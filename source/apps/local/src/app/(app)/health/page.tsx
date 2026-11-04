import type { Metadata } from "next";
import { HealthPage as HealthContent } from "@/components/pages/health-page";

export const metadata: Metadata = { title: "Taskcode — Workspace health" };
export default function HealthPage() {
  return <HealthContent />;
}
