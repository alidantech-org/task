import { WorkspacePage } from "@/components/workspace-page";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <WorkspacePage initialPath="/" />
      {children}
    </>
  );
}
