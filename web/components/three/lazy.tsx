"use client";

import dynamic from "next/dynamic";

/**
 * Client-only loaders for the WebGL scenes. R3F needs a browser context, so
 * these are imported with `ssr: false` (only allowed from a Client Component).
 */
export const LazyShaderBackground = dynamic(
  () => import("@/components/three/shader-background"),
  { ssr: false }
);

export const LazyHeroScene = dynamic(
  () => import("@/components/three/hero-scene"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-40 w-40 animate-pulse rounded-full bg-accent/10 blur-2xl" />
      </div>
    ),
  }
);
