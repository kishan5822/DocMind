import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/sections/page-header";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Get started with DocMind: install, configure your Groq key, ingest documents, and ask grounded questions.",
};

const SECTIONS = [
  {
    id: "quickstart",
    title: "Quickstart",
    body: (
      <>
        <p>Clone the repo and install dependencies into a Python 3.12 venv:</p>
        <pre>
          <code>{`python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt`}</code>
        </pre>
        <p>
          Then open the app and start uploading documents from the sidebar.
        </p>
      </>
    ),
  },
  {
    id: "configuration",
    title: "Configuration",
    body: (
      <>
        <p>
          DocMind reads its settings from environment variables. The only
          required value is your Groq API key:
        </p>
        <pre>
          <code>{`GROQ_API_KEY=your_key_here`}</code>
        </pre>
        <p>
          Tuning knobs (chunk size, retrieval counts, file limits) all have safe
          defaults — see <code>.env.example</code>.
        </p>
      </>
    ),
  },
  {
    id: "ingesting",
    title: "Ingesting documents",
    body: (
      <>
        <p>
          Upload up to your configured batch limit at once. DocMind validates
          each file, parses by format, chunks it, embeds the chunks locally, and
          indexes them for both vector and keyword search.
        </p>
        <p>
          Supported formats include PDF, DOCX, PPTX, XLSX, CSV, JSON, TXT, MD,
          HTML, and common image types.
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
          Type a question in the composer. DocMind retrieves the most relevant
          passages, sends them with your conversation history to the model, and
          streams a grounded answer back with citations.
        </p>
        <p>
          Starting a new chat clears the session&apos;s documents and memory.
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
        title="Get started in minutes"
        subtitle="Install, point DocMind at your Groq key, and start asking your documents questions."
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
