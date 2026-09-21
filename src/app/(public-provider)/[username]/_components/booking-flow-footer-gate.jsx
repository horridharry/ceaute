"use client";

import { useSelectedLayoutSegment } from "next/navigation";

export function BookingFlowFooterGate({ children }) {
  const segment = useSelectedLayoutSegment();

  return segment === "book" ? null : children;
}
