import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import "../../node_modules/monaco-editor/min/vs/editor/editor.main.css";
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
  title: "Taskcode — Local workspace",
  description: "Your local-first Taskcode workspace.",
  icons: {
    icon: "/taskcode-mark.svg",
    shortcut: "/taskcode-mark.svg",
    apple: "/taskcode-mark.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", heading.variable, body.variable)}>
      <head>
        <link rel="icon" href="/taskcode-mark.svg" type="image/svg+xml" sizes="any" />
      </head>
      <body>{children}</body>
    </html>
  );
}
