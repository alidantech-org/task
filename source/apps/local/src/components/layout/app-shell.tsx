import { App } from "@/components/layout/app-layout";
import { loadWorkspacePageState } from "@/components/workspace-page";

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const initial = await loadWorkspacePageState();
  return (
    <App {...initial} initialPath="/">
      {children}
    </App>
  );
}
