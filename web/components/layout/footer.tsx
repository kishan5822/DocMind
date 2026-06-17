"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/ui/logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/chat", label: "Open app" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/docs", label: "Docs" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/signup", label: "Create account" },
    ],
  },
];

export function Footer() {
  const pathname = usePathname();
  const hidden =
    pathname?.startsWith("/chat") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/signup");
  if (hidden) return null;

  return (
    <footer className="border-t border-border bg-bg-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-text-300">
            Ask questions grounded in your own documents. Local embeddings,
            hybrid retrieval, and citations you can trust.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-400">
              {col.title}
            </h3>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-300 transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-text-400 sm:flex-row">
          <p>© {new Date().getFullYear()} DocMind. All rights reserved.</p>
          <p>Built with local embeddings + Groq.</p>
        </div>
      </div>
    </footer>
  );
}
