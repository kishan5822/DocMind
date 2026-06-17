"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";

import {
  ClaudeChatInput,
  type ChatSubmission,
} from "@/components/ui/claude-style-chat-input";

const SUGGESTIONS = [
  "Summarize this contract",
  "What are the key risks?",
  "Compare these two reports",
  "Find every mention of revenue",
];

export function ChatDemo() {
  const [sent, setSent] = useState<string | null>(null);

  const handleSend = (data: ChatSubmission) => {
    const text =
      data.message.trim() ||
      (data.files.length ? `${data.files.length} file(s) attached` : "");
    if (text) setSent(text);
  };

  return (
    <section className="relative px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
          Try the interface
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-text-300">
          The same Claude-style composer you&apos;ll use inside DocMind —
          drag files, paste text, pick a model.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-2xl">
        <AnimatePresence mode="wait">
          {sent && (
            <motion.div
              key="reply"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 space-y-3"
            >
              <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-on-primary">
                {sent}
              </div>
              <div className="mr-auto w-fit max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-bg-100 px-4 py-3 text-sm text-text-200">
                That&apos;s the demo composer — open the full app to ingest your
                documents and get grounded, cited answers.
                <Link
                  href="/chat"
                  className="mt-2 inline-flex items-center gap-1 font-medium text-accent hover:underline"
                >
                  Open DocMind <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ClaudeChatInput
          onSendMessage={handleSend}
          placeholder="Ask anything about your documents…"
        />

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <span
              key={s}
              className="rounded-full border border-border bg-bg-100/60 px-3 py-1.5 text-sm text-text-300"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
