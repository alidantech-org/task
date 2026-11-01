"use client";

import { useWorkspaceApp } from "@/components/layout/app-layout";
import { PromptBuilder } from "@/components/layout/prompt-builder";

export function PromptsPage() {
  const { records, workspace, setNotice } = useWorkspaceApp();
  return <PromptBuilder records={records} workspace={workspace} setNotice={setNotice} />;
}
