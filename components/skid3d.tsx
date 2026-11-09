"use client";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import type { Mesh, Group } from "three";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import { RotateCcw } from "lucide-react";

export type SkidState = { fanOn: boolean; pumpOn: boolean; scrubbing: boolean; alarm: boolean };

function Fan({ on }: { on: boolean }) {
  const blades = useRef<Group>(null);
  useFrame((_, dt) => {
    if (on && blades.current) blades.current.rotation.x += dt * 12;
  });
  return (
    <group position={[-1.6, 0.6, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.32, 0.32, 0.3, 32]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.4} roughness={0.5} />
      </mesh>
      <group ref={blades} position={[0.17, 0, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[(i * Math.PI) / 2, 0, 0]} position={[0, 0.12, 0]}>
            <boxGeometry args={[0.02, 0.22, 0.08]} />
            <meshStandardMaterial color={on ? "#22d3ee" : "#475569"} />
          </mesh>
        ))}
      </group>
      {/* duct to the column */}
      <mesh position={[0.95, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 1.6, 24]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.3} roughness={0.6} />
      </mesh>
    </group>
  );
}

function Column({ glow }: { glow: boolean }) {
  const m = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const mat = m.current?.material as { emissiveIntensity?: number } | undefined;
    if (mat) mat.emissiveIntensity = glow ? 0.35 + 0.15 * Math.sin(clock.elapsedTime * 2) : 0;
  });
  return (
    <mesh ref={m} position={[0, 1.1, 0]}>
      <cylinderGeometry args={[0.35, 0.35, 2.2, 40]} />
      <meshStandardMaterial color="#e2e8f0" emissive="#0891b2" emissiveIntensity={0} metalness={0.2} roughness={0.35} />
    </mesh>
  );
}

function Sensor({ pos, label, alarm }: { pos: [number, number, number]; label: string; alarm?: boolean }) {
  const m = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const mat = m.current?.material as { emissiveIntensity?: number } | undefined;
    if (mat) mat.emissiveIntensity = alarm ? 0.6 + 0.4 * Math.sin(clock.elapsedTime * 6) : 0;
  });
  return (
    <group position={pos}>
      <mesh ref={m}>
        <boxGeometry args={[0.16, 0.12, 0.12]} />
        <meshStandardMaterial color={alarm ? "#dc2626" : "#1e293b"} emissive="#dc2626" emissiveIntensity={0} />
      </mesh>
      <Html center distanceFactor={7} position={[0, 0.18, 0]} style={{ pointerEvents: "none" }}>
        <span style={{ background: "rgba(15,23,42,.8)", color: "#fff", fontSize: 11, padding: "2px 6px", borderRadius: 6, whiteSpace: "nowrap" }}>{label}</span>
      </Html>
    </group>
  );
}

function Skid({ s }: { s: SkidState }) {
  const posts: [number, number][] = [
    [-2, -0.9],
    [2, -0.9],
    [-2, 0.9],
    [2, 0.9],
  ];
  return (
    <group>
      {/* base and frame */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[4.4, 0.1, 2.2]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {posts.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 1.2, z]}>
          <boxGeometry args={[0.08, 2.4, 0.08]} />
          <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {[-0.9, 0.9].map((z) => (
        <mesh key={z} position={[0, 2.4, z]}>
          <boxGeometry args={[4.08, 0.08, 0.08]} />
          <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      <Column glow={s.scrubbing} />
      {/* solvent tank */}
      <mesh position={[1.3, 0.45, 0.2]}>
        <cylinderGeometry args={[0.42, 0.42, 0.9, 40]} />
        <meshStandardMaterial color="#2563eb" roughness={0.4} />
      </mesh>
      {/* pump */}
      <mesh position={[0.75, 0.18, -0.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 0.35, 24]} />
        <meshStandardMaterial color={s.pumpOn ? "#10b981" : "#475569"} metalness={0.4} />
      </mesh>
      <Fan on={s.fanOn} />
      {/* vent stack */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.6, 20]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <Sensor pos={[-1.15, 0.85, 0]} label="AT-102 exhaust" />
      <Sensor pos={[-0.6, 0.85, 0]} label="AT-103 inlet CO2" />
      <Sensor pos={[0, 2.85, 0]} label="AT-104 outlet CO2" />
      <Sensor pos={[-1.9, 2.1, 0.9]} label="AT-101 ambient" alarm={s.alarm} />
    </group>
  );
}

export function Skid3D({ state, height = 520 }: { state: SkidState; height?: number }) {
  const controls = useRef<OrbitImpl>(null);
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-[#0b1222]" style={{ height }}>
      <Canvas camera={{ position: [4.2, 3.2, 4.6], fov: 40 }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}>
        <color attach="background" args={["#0b1222"]} />
        <hemisphereLight args={["#ffffff", "#1e293b", 0.9]} />
        <directionalLight position={[5, 8, 5]} intensity={1.4} />
        <directionalLight position={[-6, 4, -3]} intensity={0.5} />
        <Skid s={state} />
        <OrbitControls ref={controls} target={[0, 1, 0]} enablePan={false} minDistance={3} maxDistance={12} />
      </Canvas>
      <button onClick={() => controls.current?.reset()} className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white">
        <RotateCcw aria-hidden className="h-3.5 w-3.5" /> Reset view
      </button>
      <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">Illustrative model</span>
    </div>
  );
}
