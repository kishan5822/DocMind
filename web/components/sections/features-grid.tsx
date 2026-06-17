"use client";

import {
  FileStack,
  Cpu,
  Layers,
  ShieldCheck,
  Quote,
  Gauge,
} from "lucide-react";

import { Reveal } from "@/components/ui/reveal";

const FEATURES = [
  {
    icon: FileStack,
    title: "Any document, parsed",
    body: "PDFs, DOCX, PPTX, XLSX, CSV, JSON, Markdown, HTML, and images — validated and parsed into clean, structured text.",
  },
  {
    icon: Cpu,
    title: "Local embeddings",
    body: "Documents are embedded on your machine with BAAI/bge-base-en-v1.5. No third party ever sees your raw content.",
  },
  {
    icon: Layers,
    title: "Hybrid retrieval",
    body: "Dense vector search and BM25 keyword search are fused with reciprocal rank fusion, then reranked for the top results.",
  },
  {
    icon: Quote,
    title: "Answers with citations",
    body: "Every response is grounded in retrieved chunks, so you can trace each claim back to the source passage.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Per-session isolation in ChromaDB, automatic TTL cleanup, and a single, audited egress point for the LLM call.",
  },
  {
    icon: Gauge,
    title: "Fast where it counts",
    body: "Models are warmed at startup and retrieval is tuned, so the only wait is the answer streaming back to you.",
  },
];

export function FeaturesGrid() {
  return (
    <section className="relative px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Why DocMind
          </p>
          <h2 className="mt-3 font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
            Grounded answers, end to end
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08}>
              <article className="group h-full rounded-2xl border border-border bg-bg-100 p-6 transition-all hover:-translate-y-1 hover:shadow-input-hover">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-300">
                  {f.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
