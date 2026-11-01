import type { Metadata } from "next";
import { OverviewPage } from "@/components/pages/overview-page";

export const metadata: Metadata = { title: "Task — Workspace overview" };
export default function HomePage() {
  return <OverviewPage />;
}
