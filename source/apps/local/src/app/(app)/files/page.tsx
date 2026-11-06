import type { Metadata } from "next";
import { FileViewerPage } from "@/components/pages/file-viewer-page";

export const metadata: Metadata = { title: "Taskcode — File" };
export const dynamic = "force-dynamic";

export default function FilePage() {
  return <FileViewerPage />;
}
