import { Hero } from "@/components/sections/hero";
import { ChatDemo } from "@/components/sections/chat-demo";
import { FeaturesGrid } from "@/components/sections/features-grid";
import { HowItWorks } from "@/components/sections/how-it-works";
import { CTA } from "@/components/sections/cta";

export default function Home() {
  return (
    <>
      <Hero />
      <FeaturesGrid />
      <ChatDemo />
      <HowItWorks />
      <CTA />
    </>
  );
}
