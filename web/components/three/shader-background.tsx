"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useTheme } from "@/components/layout/theme-provider";

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Plane spans clip space [-1,1]; render fullscreen regardless of camera.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;

  // Ashima 2D simplex noise.
  vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x){ return mod289(((x * 34.0) + 1.0) * x); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                          + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                            dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv;
    p.x *= uResolution.x / max(uResolution.y, 1.0); // aspect correct
    float t = uTime * 0.04;

    // Domain-warped noise for slow, organic flow.
    float n1 = snoise(p * 1.4 + vec2(t, t * 0.7));
    float n2 = snoise(p * 2.0 + vec2(-t * 0.5, t * 0.3) + n1);
    float blob = snoise(p * 1.1 + vec2(n2 * 0.6, -t));

    float mixAB = smoothstep(-0.4, 0.6, blob);
    float mixC  = smoothstep(0.2, 0.9, n2);

    vec3 col = mix(uColorA, uColorB, mixAB * 0.55);
    col = mix(col, uColorC, mixC * 0.14);

    // Soft vignette back toward the canvas color for readable foreground text.
    float vig = smoothstep(1.25, 0.15, length(uv - 0.5));
    col = mix(uColorA, col, vig);

    gl_FragColor = vec4(col, 1.0);
  }
`;

type Palette = { a: string; b: string; c: string };

function GradientPlane({
  palette,
  paused,
}: {
  palette: Palette;
  paused: boolean;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size, viewport } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uColorA: { value: new THREE.Color(palette.a) },
      uColorB: { value: new THREE.Color(palette.b) },
      uColorC: { value: new THREE.Color(palette.c) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Keep colors in sync when the theme flips.
  useMemo(() => {
    uniforms.uColorA.value.set(palette.a);
    uniforms.uColorB.value.set(palette.b);
    uniforms.uColorC.value.set(palette.c);
  }, [palette, uniforms]);

  useFrame((_, delta) => {
    if (!materialRef.current) return;
    uniforms.uResolution.value.set(
      size.width * viewport.dpr,
      size.height * viewport.dpr
    );
    if (!paused) uniforms.uTime.value += delta;
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

const LIGHT_PALETTE: Palette = { a: "#faf9f5", b: "#cc785c", c: "#5db8a6" };
const DARK_PALETTE: Palette = { a: "#1a1916", b: "#cc785c", c: "#5db8a6" };

export function ShaderBackground({ className }: { className?: string }) {
  const { theme } = useTheme();
  const palette = theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className={className}
      aria-hidden
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: false }}
        style={{ width: "100%", height: "100%" }}
      >
        <GradientPlane palette={palette} paused={prefersReduced} />
      </Canvas>
    </div>
  );
}

export default ShaderBackground;
