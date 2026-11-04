"use client";

import { usePathname } from "next/navigation";
import { DocumentReaderPage } from "@/components/pages/document-reader-page";
import { DocumentsPage } from "@/components/pages/documents-page";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { resolveDocumentRoute } from "@/lib/document-route";

/** Displays a file at its workspace path or the folder browser at a directory path. */
export function DocumentsPathPage() {
  const pathname = usePathname() ?? "";
  const { docs } = useWorkspaceApp();
  const route = resolveDocumentRoute(pathname, docs);
  return route?.kind === "document" ? <DocumentReaderPage /> : <DocumentsPage />;
}
