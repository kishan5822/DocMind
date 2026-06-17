import { Reveal } from "@/components/ui/reveal";

/** Consistent inner-page header. Top padding clears the fixed navbar. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="px-6 pt-36 pb-12 text-center">
      <Reveal className="mx-auto max-w-3xl">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-3 font-serif text-5xl font-light tracking-tight text-foreground sm:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-300">
            {subtitle}
          </p>
        )}
      </Reveal>
    </header>
  );
}
