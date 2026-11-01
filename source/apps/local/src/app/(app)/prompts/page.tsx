import { PromptsPage as PromptsContent } from "@/components/pages/prompts-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Task — Agent prompts" };
export default function PromptsPage() {
  return <PromptsContent />;
}
