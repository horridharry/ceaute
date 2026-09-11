import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import AppHeader from "@/components/app-header/app-header";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
      <body className="min-h-full flex flex-col">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}


