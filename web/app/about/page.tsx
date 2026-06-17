import type { Metadata } from "next";

import { PageHeader } from "@/components/sections/page-header";
import { Reveal } from "@/components/ui/reveal";
import { CTA } from "@/components/sections/cta";

export const metadata: Metadata = {
  title: "About",
  description:
    "DocMind is a privacy-first document Q&A system: local embeddings, hybrid retrieval, and answers grounded in your own files.",
};

const STATS = [
  { value: "10+", label: "File formats parsed" },
  { value: "100%", label: "Embeddings run locally" },
  { value: "1", label: "Audited LLM egress point" },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="Documents you can interrogate"
        subtitle="DocMind started from a simple frustration: search finds pages, but it doesn't answer questions. We wanted grounded answers you can trust."
      />

      <section className="px-6 pb-8">
        <Reveal className="mx-auto max-w-3xl space-y-6 text-lg leading-relaxed text-text-200">
          <p>
            Most AI tools ask you to paste your private documents into someone
            else&apos;s cloud. DocMind takes the opposite stance: your files are
            parsed, chunked, and embedded locally, then stored in an isolated
            per-session vector store that&apos;s cleaned up automatically.
          </p>
          <p>
            When you ask a question, DocMind runs both semantic and keyword
            search, fuses the results, and reranks them with a local
            cross-encoder. Only the most relevant passages — never your whole
            corpus — are sent to the language model to compose a cited answer.
          </p>
          <p>
            The result is a system that feels conversational but stays
            accountable: every claim traces back to a passage you can read.
          </p>
        </Reveal>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div className="rounded-2xl border border-border bg-bg-100 p-8 text-center">
                <div className="font-serif text-5xl font-light text-accent">
                  {s.value}
                </div>
                <p className="mt-2 text-sm text-text-300">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <CTA />
    </>
  );
}
