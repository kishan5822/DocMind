"use client";

import { motion } from "framer-motion";

/** Fade-and-rise a block into view as it scrolls into the viewport. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.2, 0, 0, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
