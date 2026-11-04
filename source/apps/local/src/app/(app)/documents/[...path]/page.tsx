import type { Metadata } from "next";
import { DocumentsPathPage } from "@/components/pages/documents-path-page";

export const metadata: Metadata = { title: "Taskcode — Documents" };
export const dynamic = "force-dynamic";

export default function DocumentsPath() {
  return <DocumentsPathPage />;
}
