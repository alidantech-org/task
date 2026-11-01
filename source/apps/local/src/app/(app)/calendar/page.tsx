import { CalendarPage } from "@/components/pages/calendar-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Task — Calendar" };

export default function Page() {
  return <CalendarPage />;
}
