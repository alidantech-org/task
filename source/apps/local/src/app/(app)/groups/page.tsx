import { GroupsPage as GroupsContent } from "@/components/pages/groups-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Task — Groups" };
export default function GroupsPage() {
  return <GroupsContent />;
}
