"use client";

import { Reveal } from "@/components/ui/reveal";

const STEPS = [
  {
    n: "01",
    title: "Upload & validate",
    body: "Drop your files. DocMind checks size, type, and magic bytes before anything is processed.",
  },
  {
    n: "02",
    title: "Parse & chunk",
    body: "Each document is parsed by format and split into ~512-token chunks with overlap to preserve context.",
  },
  {
    n: "03",
    title: "Embed & index",
    body: "Chunks are embedded locally and stored in a per-session ChromaDB, alongside a BM25 keyword index.",
  },
  {
    n: "04",
    title: "Retrieve & rerank",
    body: "Your question pulls candidates from dense + keyword search, fused with RRF and reranked to the best five.",
  },
  {
    n: "05",
    title: "Answer & cite",
    body: "The top context and your history are sent to the model, which streams back a grounded, cited answer.",
  },
];

export function HowItWorks() {
  return (
    <section className="relative overflow-hidden px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            The pipeline
          </p>
          <h2 className="mt-3 font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
            From file to footnote
          </h2>
          <p className="mt-4 text-lg text-text-300">
            A twelve-stage pipeline, distilled into five moves.
          </p>
        </Reveal>

        <ol className="relative mt-16 space-y-px">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.05}>
              <li className="grid grid-cols-[auto_1fr] items-start gap-6 border-t border-border py-8 last:border-b">
                <span className="font-serif text-3xl font-light text-accent">
                  {s.n}
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {s.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-300">
                    {s.body}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
