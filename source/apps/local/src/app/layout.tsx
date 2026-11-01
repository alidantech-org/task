import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import "@/app/globals.css";

const heading = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-bricolage",
});
const body = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: "Task — Local workspace",
  description: "Your local-first Task workspace.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", heading.variable, body.variable)}>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" sizes="any" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
