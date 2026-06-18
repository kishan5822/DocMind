import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/sections/page-header";
import { Reveal } from "@/components/ui/reveal";

const REPO_URL = "https://github.com/kishan5822/DocMind";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "How to use DocMind: create an account, upload your documents, ask questions, and get cited answers — right in your browser.",
};

const SECTIONS = [
  {
    id: "getting-started",
    title: "Getting started",
    body: (
      <>
        <p>
          DocMind runs entirely in your browser — there&apos;s nothing to install
          and nothing to configure.{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Create an account
          </Link>{" "}
          (or{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            sign in
          </Link>
          ), then open the app to start a conversation.
        </p>
        <p>
          <Link href="/chat" className="font-medium text-accent hover:underline">
            Open the app
          </Link>{" "}
          and you&apos;ll land in a fresh chat, ready for your first document.
        </p>
      </>
    ),
  },
  {
    id: "documents",
    title: "Adding your documents",
    body: (
      <>
        <p>
          Attach files straight from the chat composer (or the sidebar).
          They&apos;re ingested automatically the moment you add them — the send
          button stays locked until your files are ready.
        </p>
        <p>
          Supported formats: PDF (including scanned PDFs), DOCX, PPTX, XLSX, CSV,
          JSON, TXT, MD, HTML, and common image types (PNG/JPG).
        </p>
        <p>
          Need to remove something? Delete any file at any time — its content is
          dropped from the conversation right away.
        </p>
      </>
    ),
  },
  {
    id: "asking",
    title: "Asking questions",
    body: (
      <>
        <p>
          Type a question in the composer. DocMind finds the most relevant
          passages in your files, sends them to the model, and streams back an
          answer grounded in your documents — with citations you can trace.
        </p>
        <p>
          Starting a new chat clears that session&apos;s documents and memory, so
          each conversation stays focused on its own files.
        </p>
      </>
    ),
  },
  {
    id: "models",
    title: "Choosing a model",
    body: (
      <>
        <p>
          Use the model dropdown in the composer to pick which model answers you.
          You can switch models at any point in a conversation — the next reply
          uses your new choice.
        </p>
      </>
    ),
  },
  {
    id: "self-hosting",
    title: "Self-hosting & development",
    body: (
      <>
        <p>
          DocMind is open source. If you want to run it yourself, configure it, or
          read how the retrieval pipeline works under the hood, everything lives
          on GitHub.
        </p>
        <p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            View the source on GitHub →
          </a>
        </p>
      </>
    ),
  },
];

export default function DocsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="Using DocMind"
        subtitle="Upload your documents and ask questions — get cited answers right in your browser. No install, no setup."
      />

      <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-28 lg:grid-cols-[220px_1fr]">
        {/* Sidebar nav */}
        <aside className="hidden lg:block">
          <nav className="sticky top-28 space-y-1">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-lg px-3 py-2 text-sm text-text-300 transition-colors hover:bg-bg-200 hover:text-foreground"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="max-w-2xl space-y-14">
          {SECTIONS.map((s) => (
            <Reveal key={s.id}>
              <section id={s.id} className="scroll-mt-28">
                <h2 className="font-serif text-3xl font-light tracking-tight text-foreground">
                  {s.title}
                </h2>
                <div className="prose-docs mt-4 space-y-4 text-base leading-relaxed text-text-200">
                  {s.body}
                </div>
              </section>
            </Reveal>
          ))}

          <div className="rounded-2xl border border-border bg-bg-100 p-6">
            <p className="text-sm text-text-300">
              Ready to try it?{" "}
              <Link href="/chat" className="font-medium text-accent hover:underline">
                Open the app
              </Link>{" "}
              and ingest your first document.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
