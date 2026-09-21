"use client";

import { usePathname } from "next/navigation";
import { isFocusedTaskRoute } from "../_lib/focused-task-routes";

export function FocusedTaskHeaderGate({ children }) {
  const pathname = usePathname();

  return isFocusedTaskRoute(pathname) ? null : children;
}
