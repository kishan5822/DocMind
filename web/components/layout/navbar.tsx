"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/about", label: "About" },
  { href: "/docs", label: "Docs" },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Hide the marketing chrome on the full-bleed app and focused auth screens.
  const hidden =
    pathname?.startsWith("/chat") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/signup");
  if (hidden) return null;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border/60 bg-bg-0/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" aria-label="DocMind home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-text-300 hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <span
                className="hidden max-w-[160px] truncate text-sm text-text-300 sm:inline-flex"
                title={user.email}
              >
                {user.email}
              </span>
              <button
                type="button"
                onClick={logout}
                className="hidden rounded-xl px-3 py-2 text-sm font-medium text-text-300 transition-colors hover:text-foreground sm:inline-flex"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-xl px-3 py-2 text-sm font-medium text-text-300 transition-colors hover:text-foreground sm:inline-flex"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/chat"
            className="inline-flex h-9 items-center rounded-xl bg-accent px-4 text-sm font-medium text-on-primary shadow-sm transition-colors hover:bg-accent-hover active:scale-[0.98]"
          >
            Open app
          </Link>
          {/* Hamburger — mobile only */}
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-300 transition-colors hover:bg-bg-200 hover:text-foreground md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown panel */}
      {mobileOpen && (
        <div className="border-t border-border bg-bg-0/95 backdrop-blur-xl md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "text-foreground" : "text-text-300 hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-border pt-3">
              {user ? (
                <>
                  <p className="mb-2 truncate px-3 text-xs text-text-400" title={user.email}>
                    {user.email}
                  </p>
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-text-300 transition-colors hover:text-foreground"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-text-300 transition-colors hover:text-foreground"
                >
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
