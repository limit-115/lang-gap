"use client";

import type {} from "react/canary";
import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ViewTransition key={pathname} name="page-content" share="page-change" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
