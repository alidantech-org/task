import type { Metadata } from "next";
import { DocumentReaderPage } from "@/components/pages/document-reader-page";

export const metadata: Metadata = { title: "Task — Document" };
export const dynamic = "force-dynamic";

export default function DocumentPage() {
  return <DocumentReaderPage />;
}
