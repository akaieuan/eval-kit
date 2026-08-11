import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { themeInitScript } from "@eval-kit/ui";
import { DashboardShell } from "@/components/Shell";
import "./globals.css";

/*
 * akaOSS's two families and no third: Inter for human voice, JetBrains Mono
 * for anything machine-generated (run ids, tool names, scores, timestamps).
 *
 * These were named in tokens.css from the start but never actually loaded —
 * the app rendered in system SF, and the `font-feature-settings: "ss01",
 * "cv11"` in globals.css (both Inter-specific) were inert.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "eval-kit",
  description:
    "Scores whether your agent respects human authority — stops when it must, asks when it should.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
