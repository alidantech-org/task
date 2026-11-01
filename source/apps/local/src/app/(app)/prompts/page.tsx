import type { Metadata } from "next";
import { PromptsPage as PromptsContent } from "@/components/pages/prompts-page";

export const metadata: Metadata = { title: "Task — Agent prompts" };
export default function PromptsPage() {
  return <PromptsContent />;
}
