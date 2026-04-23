import type { Metadata } from "next";
import type { ReactNode } from "react";
import { themeInitScript } from "@eval-kit/ui";
import { DashboardShell } from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "eval-kit",
  description: "HITL eval dashboard for research agents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
