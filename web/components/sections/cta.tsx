"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Reveal } from "@/components/ui/reveal";
import { LogoMark } from "@/components/ui/logo";

export function CTA() {
  return (
    <section className="px-6 pb-28 pt-8">
      <Reveal className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface-dark px-8 py-16 text-center sm:px-16">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
          <LogoMark className="mx-auto h-10 w-10 text-accent" />
          <h2 className="mx-auto mt-6 max-w-2xl font-serif text-4xl font-light tracking-tight text-on-dark sm:text-5xl">
            Put your documents to work.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-on-dark/70">
            Upload, ask, and get answers you can trace. No setup, no data
            leaving your control.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/chat"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-accent px-6 text-sm font-medium text-on-primary shadow-md transition-colors hover:bg-accent-hover active:scale-[0.98]"
            >
              Open the app <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-12 items-center rounded-2xl border border-on-dark/20 px-6 text-sm font-medium text-on-dark transition-colors hover:bg-on-dark/10"
            >
              Create an account
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
