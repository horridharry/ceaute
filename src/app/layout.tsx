import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";

import "./globals.css";

// Geist is the only family in the product — 400/500/600, no monospace.
const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "Ceaute",
  description: "Discover and book independent beauty providers.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#8c2b52" }, // plum
    { media: "(prefers-color-scheme: dark)", color: "#1e293b" }, // Dark gray for dark mode
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geist.className} h-full antialiased`}
    >
      {/* The header is rendered by the screens that want it, not here: the
          stacked, modal and letter templates each supply their own nav, and a
          letter screen must have nothing at all in its top right. */}
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}


