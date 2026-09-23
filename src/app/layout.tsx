import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ceaute",
  description: "Discover and book independent beauty providers.",
};

// No scale limit, so people can pinch-zoom; the browser chrome is white in
// both OS themes because the app is light-only. viewport-fit=cover lets the
// bars fixed to the bottom of the screen (the setup guide, the booking bar,
// sheets) pad themselves with env(safe-area-inset-bottom) on notched phones.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.className} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}


