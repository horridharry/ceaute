import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });

import "./globals.css";


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
    { media: "(prefers-color-scheme: light)", color: "#f472b6" }, // Pink color for light mode
    { media: "(prefers-color-scheme: dark)", color: "#1e293b" }, // Dark gray for dark mode
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.className} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
