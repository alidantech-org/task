import type { Metadata } from "next";
import { GroupsPage as GroupsContent } from "@/components/pages/groups-page";

export const metadata: Metadata = { title: "Task — Groups" };
export default function GroupsPage() {
  return <GroupsContent />;
}
