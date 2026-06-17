import type { Metadata } from "next";

import { PageHeader } from "@/components/sections/page-header";
import { FeaturesGrid } from "@/components/sections/features-grid";
import { HowItWorks } from "@/components/sections/how-it-works";
import { CTA } from "@/components/sections/cta";

export const metadata: Metadata = {
  title: "Features",
  description:
    "How DocMind turns documents into grounded, cited answers: multi-format parsing, local embeddings, hybrid retrieval, and reranking.",
};

export default function FeaturesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Features"
        title="Built for trustworthy answers"
        subtitle="DocMind pairs local, private embeddings with hybrid retrieval and reranking — so every answer is grounded in your own documents."
      />
      <FeaturesGrid />
      <HowItWorks />
      <CTA />
    </>
  );
}
