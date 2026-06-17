"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      type="button"
      className={className}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

/** Renders assistant answers (markdown) with theme-aware typography. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md text-[15px] leading-relaxed text-text-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, node: _node, ...props }: any) {
            const language = /language-(\w+)/.exec(className ?? "")?.[1];
            const code = String(children).replace(/\n$/, "");

            if (language) {
              return (
                <div className="relative group/code my-3">
                  <div className="flex items-center justify-between bg-[#1e1e1e] rounded-t-lg px-4 py-1.5 border border-b-0 border-bg-300">
                    <span className="text-[11px] text-text-400 font-mono">{language}</span>
                    <CopyButton
                      text={code}
                      className="text-[11px] text-text-400 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-white/10"
                    />
                  </div>
                  <SyntaxHighlighter
                    language={language}
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      borderRadius: "0 0 0.5rem 0.5rem",
                      border: "1px solid var(--bg-300)",
                      fontSize: "13px",
                      lineHeight: "1.6",
                    }}
                    PreTag="div"
                  >
                    {code}
                  </SyntaxHighlighter>
                </div>
              );
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
          pre({ children }) {
            return <>{children}</>;
          },
          table: ({ node: _node, ...props }) => (
            <div className="overflow-x-auto my-3">
              <table {...props} />
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Copy button for a full message — placed by the parent. */
export function MessageCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      type="button"
      className="mt-1 text-[11px] text-text-400 hover:text-text-200 transition-colors px-1"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
