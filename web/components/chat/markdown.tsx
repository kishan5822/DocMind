"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function CodeBlock({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false);

  const codeEl = React.Children.toArray(children).find(
    (c): c is React.ReactElement<{ children?: React.ReactNode }> =>
      React.isValidElement(c) && (c as React.ReactElement).type === "code"
  );
  const raw = codeEl?.props?.children ?? "";
  const text = Array.isArray(raw) ? raw.join("") : String(raw);

  const copy = () => {
    navigator.clipboard.writeText(text.trimEnd());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code">
      <pre {...props}>{children}</pre>
      <button
        onClick={copy}
        type="button"
        className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity
                   rounded-md bg-bg-200 border border-bg-300 px-2 py-0.5 text-[11px]
                   text-text-300 hover:text-text-100 hover:bg-bg-300"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

/** Renders assistant answers (markdown) with theme-aware typography. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md text-[15px] leading-relaxed text-text-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
          table: ({ node: _node, ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} />
            </div>
          ),
          code: ({ className, children, node: _node, ...props }: any) => {
            const isBlock = /^language-/.test(className ?? "");
            if (isBlock) {
              return <code className={className} {...props}>{children}</code>;
            }
            return (
              <code
                className="rounded bg-bg-200 px-1 py-0.5 text-[0.875em] font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
