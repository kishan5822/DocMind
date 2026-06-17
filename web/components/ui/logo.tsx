import * as React from "react";

import { cn } from "@/lib/utils";

/** Anthropic-style radial "spike" mark, tinted with the brand accent. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      className={cn("h-7 w-7", className)}
    >
      <defs>
        <ellipse id="petal-pair" cx="100" cy="100" rx="90" ry="20" />
      </defs>
      <g fill="currentColor" fillRule="evenodd">
        <use href="#petal-pair" transform="rotate(0 100 100)" />
        <use href="#petal-pair" transform="rotate(45 100 100)" />
        <use href="#petal-pair" transform="rotate(90 100 100)" />
        <use href="#petal-pair" transform="rotate(135 100 100)" />
      </g>
    </svg>
  );
}

/** Full wordmark: radial mark + "DocMind" set in the serif display face. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-6 w-6 text-accent" />
      <span className="font-serif text-xl tracking-tight text-foreground">
        DocMind
      </span>
    </span>
  );
}
