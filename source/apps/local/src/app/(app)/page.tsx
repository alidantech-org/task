import { OverviewPage } from "@/components/pages/overview-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Task — Workspace overview" };
export default function HomePage() {
  return <OverviewPage />;
}
