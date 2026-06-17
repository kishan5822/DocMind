"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeElements } from "@react-three/fiber";
import { Float, Icosahedron, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

import { useTheme } from "@/components/layout/theme-provider";

type Colors = { accent: string; card: string; particle: string };

const LIGHT_COLORS: Colors = {
  accent: "#cc785c",
  card: "#ffffff",
  particle: "#cc785c",
};
const DARK_COLORS: Colors = {
  accent: "#d2996e",
  card: "#2a2825",
  particle: "#d2996e",
};

/** The central distorted "knowledge core". */
function KnowledgeCore({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.15;
  });
  return (
    <Float speed={1.4} rotationIntensity={0.5} floatIntensity={0.8}>
      <Icosahedron ref={ref} args={[1.15, 4]}>
        <MeshDistortMaterial
          color={color}
          distort={0.35}
          speed={1.6}
          roughness={0.25}
          metalness={0.1}
        />
      </Icosahedron>
    </Float>
  );
}

/** A thin floating panel standing in for a document. */
function DocCard({
  color,
  position,
  rotation,
}: {
  color: string;
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  return (
    <Float speed={2} rotationIntensity={0.6} floatIntensity={1.2}>
      <mesh position={position} rotation={rotation} castShadow>
        <boxGeometry args={[1.1, 1.45, 0.04]} />
        <meshStandardMaterial
          color={color}
          roughness={0.5}
          metalness={0.05}
        />
      </mesh>
    </Float>
  );
}

/** A slowly drifting particle field. */
function Particles({ color, count = 220 }: { color: string; count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 14;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 9;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color={color}
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/** Wraps the scene and applies gentle mouse parallax to the whole group. */
function ParallaxGroup({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
} & ThreeElements["group"]) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current || !enabled) return;
    const targetX = state.pointer.y * 0.18;
    const targetY = state.pointer.x * 0.25;
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      targetX,
      0.04
    );
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      targetY,
      0.04
    );
  });
  return <group ref={group}>{children}</group>;
}

export function HeroScene({ className }: { className?: string }) {
  const { theme } = useTheme();
  const colors = theme === "dark" ? DARK_COLORS : LIGHT_COLORS;

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className={className} aria-hidden>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 6, 5]} intensity={1.4} />
        <pointLight position={[-5, -3, 2]} intensity={40} color={colors.accent} />

        <ParallaxGroup enabled={!prefersReduced}>
          <KnowledgeCore color={colors.accent} />
          <DocCard
            color={colors.card}
            position={[-2.6, 0.6, -0.5]}
            rotation={[0.2, 0.5, 0.1]}
          />
          <DocCard
            color={colors.card}
            position={[2.7, -0.4, -0.8]}
            rotation={[-0.15, -0.4, -0.12]}
          />
          <DocCard
            color={colors.card}
            position={[2.1, 1.5, -1.6]}
            rotation={[0.3, -0.6, 0.05]}
          />
          <Particles color={colors.particle} />
        </ParallaxGroup>
      </Canvas>
    </div>
  );
}

export default HeroScene;
