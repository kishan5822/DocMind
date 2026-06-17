"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

import { LazyStrands, LazyShaderBackground } from "@/components/three/lazy";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Animated shader backdrop. */}
      <LazyShaderBackground className="opacity-70" />
      {/* Readability scrim. */}
      <div className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-b from-bg-0/30 via-bg-0/10 to-bg-0" />

      <div className="relative mx-auto grid min-h-[88vh] max-w-7xl items-center gap-8 px-6 pt-28 pb-16 lg:grid-cols-2">
        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
          className="max-w-xl"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-100/70 px-3 py-1 text-xs font-medium text-text-300 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Local embeddings · Hybrid retrieval · Cited answers
          </span>

          <h1 className="mt-6 font-serif text-5xl font-light leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Ask your documents{" "}
            <span className="relative whitespace-nowrap text-accent">
              anything
            </span>
            .
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-text-300">
            DocMind turns PDFs, decks, and spreadsheets into a grounded
            knowledge base — then answers your questions with citations you can
            actually trust.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/chat"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-accent px-6 text-sm font-medium text-on-primary shadow-md transition-colors hover:bg-accent-hover active:scale-[0.98]"
            >
              Open the app
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/features"
              className="inline-flex h-12 items-center rounded-2xl border border-border bg-bg-100/60 px-6 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-bg-200"
            >
              See how it works
            </Link>
          </div>
        </motion.div>

        {/* Strands animation */}
        <div className="relative h-[360px] w-full lg:h-[560px]">
          <LazyStrands
            colors={["#7C3AED", "#06B6D4", "#F97316"]}
            count={4}
            speed={0.4}
            amplitude={1.2}
            waviness={1}
            thickness={0.8}
            glow={2.8}
            taper={2.5}
            spread={1.1}
            intensity={0.65}
            saturation={1.6}
            opacity={1}
            scale={1.4}
          />
        </div>
      </div>
    </section>
  );
}
