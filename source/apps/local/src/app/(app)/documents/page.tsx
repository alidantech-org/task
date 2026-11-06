import type { Metadata } from "next";
import { DocumentsPage as DocumentsContent } from "@/components/pages/documents-page";

export const metadata: Metadata = { title: "Taskcode — Documents" };
export const dynamic = "force-dynamic";

export default function DocumentsPage() {
  return <DocumentsContent />;
}
