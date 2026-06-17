"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Enter-only route transition. Keyed by pathname so each navigation remounts
 * and replays the fade-up. Exit animations are intentionally omitted — they
 * require keeping the old route mounted, which fights App Router streaming.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.main
      key={pathname}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.main>
  );
}
