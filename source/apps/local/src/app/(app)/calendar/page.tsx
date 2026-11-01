import type { Metadata } from "next";
import { CalendarPage } from "@/components/pages/calendar-page";

export const metadata: Metadata = { title: "Task — Calendar" };

export default function Page() {
  return <CalendarPage />;
}
