"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders assistant answers (markdown) with theme-aware typography. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md text-[15px] leading-relaxed text-text-100">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
