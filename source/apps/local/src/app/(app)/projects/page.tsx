import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectsPage as ProjectsContent } from "@/components/pages/projects-page";

export const metadata: Metadata = { title: "Task — Project group" };
export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsContent />
    </Suspense>
  );
}
