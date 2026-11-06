import type { Metadata } from "next";
import { CodeExplorerPage } from "@/components/pages/code-explorer-page";

export const metadata: Metadata = { title: "Taskcode — Code" };
export const dynamic = "force-dynamic";

export default function CodePage() {
  return <CodeExplorerPage />;
}
