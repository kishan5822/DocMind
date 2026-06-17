"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Logo } from "@/components/ui/logo";

type Mode = "login" | "signup";

const COPY: Record<
  Mode,
  { title: string; subtitle: string; cta: string; altText: string; altHref: string; altLabel: string }
> = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to pick up where you left off.",
    cta: "Sign in",
    altText: "New to DocMind?",
    altHref: "/signup",
    altLabel: "Create an account",
  },
  signup: {
    title: "Create your account",
    subtitle: "Start asking your documents anything.",
    cta: "Create account",
    altText: "Already have an account?",
    altHref: "/login",
    altLabel: "Sign in",
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const { login, signup } = useAuth();
  const router = useRouter();
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") await login(email, password);
      else await signup(email, password);
      router.push("/chat");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof TypeError)
        setError("Can't reach the server. Is the API running?");
      else setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="flex min-h-screen items-center justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        className="w-full max-w-sm"
      >
        <Link href="/" className="mb-8 flex justify-center" aria-label="DocMind home">
          <Logo />
        </Link>

        <div className="rounded-3xl border border-border bg-bg-100 p-8 shadow-input">
          <h1 className="text-center font-serif text-3xl font-light tracking-tight text-foreground">
            {copy.title}
          </h1>
          <p className="mt-2 text-center text-sm text-text-300">
            {copy.subtitle}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-text-200"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-bg-0 px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-text-400 focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-text-200"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-bg-0 px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-text-400 focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-on-primary shadow-sm transition-colors hover:bg-accent-hover active:scale-[0.99] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {copy.cta}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-300">
            {copy.altText}{" "}
            <Link
              href={copy.altHref}
              className="font-medium text-accent hover:underline"
            >
              {copy.altLabel}
            </Link>
          </p>
        </div>
      </motion.div>
    </section>
  );
}
