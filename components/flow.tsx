import { num } from "@/lib/format";

export const STAGES = [
  { id: "flue", name: "Mini-Refinery Furnace Flue", short: "Furnace Flue", flow: 450, pKpa: 101.8, tC: 182, tags: ["FT-301", "AT-103"] },
  { id: "chiller", name: "Chiller", short: "Chiller", flow: 450, pKpa: 101.6, tC: 38, tags: ["TT-303"] },
  { id: "column", name: "Packed Absorption Column", short: "Absorption Column", flow: 450, pKpa: 236.9, tC: 42.4, tags: ["PDT-302", "AIT-304", "AIT-305", "LT-401"] },
  { id: "ndir", name: "NDIR Sensors", short: "NDIR Sensors", flow: 446, pKpa: 100.1, tC: 40.1, tags: ["AT-104"] },
  { id: "storage", name: "Storage Tanks", short: "Storage Tanks", flow: 0.18, pKpa: 1940, tC: -21.8, tags: ["FQ-501"] },
] as const;
export type StageId = (typeof STAGES)[number]["id"];

/** Which stages carry flow for each firmware scrubber state. */
export function activeStages(scrubber?: string): Set<StageId> {
  if (scrubber === "SCRUBBING") return new Set(["flue", "chiller", "column", "ndir", "storage"]);
  if (scrubber === "INTAKE_ACTIVE") return new Set(["flue", "chiller"]);
  if (scrubber === "PURGING") return new Set(["column", "ndir"]);
  return new Set();
}

/** 2D process flow drawn as SVG with animated flow lines on active segments. */
export function ProcessFlow({ active, onStage, selected }: { active: Set<StageId>; onStage?: (id: StageId) => void; selected?: StageId | null }) {
  const W = 1000;
  const boxW = 160;
  const gap = (W - boxW * 5) / 4;
  return (
    <svg viewBox="0 0 1000 180" className="h-auto w-full" role="group" aria-label="Process flow: furnace flue to chiller to packed absorption column to NDIR sensors to storage tanks">
      {STAGES.slice(0, -1).map((s, i) => {
        const x1 = i * (boxW + gap) + boxW;
        const x2 = x1 + gap;
        const on = active.has(s.id) && active.has(STAGES[i + 1].id);
        return (
          <g key={s.id}>
            <line x1={x1} y1={90} x2={x2 - 8} y2={90} stroke={on ? "var(--fluid)" : "var(--line)"} strokeWidth={4} className={on ? "flow-line" : undefined} />
            <polygon points={`${x2 - 10},82 ${x2},90 ${x2 - 10},98`} fill={on ? "var(--fluid)" : "var(--line)"} />
          </g>
        );
      })}
      {STAGES.map((s, i) => {
        const x = i * (boxW + gap);
        const on = active.has(s.id);
        const sel = selected === s.id;
        const content = (
          <>
            <rect x={x} y={40} width={boxW} height={100} rx={10} fill="var(--elev)" stroke={sel ? "var(--primary)" : on ? "var(--fluid)" : "var(--line)"} strokeWidth={sel ? 3 : 2} />
            <text x={x + boxW / 2} y={74} textAnchor="middle" fontSize={15} fontWeight={600} fill="var(--fg)">
              {s.short}
            </text>
            <text x={x + boxW / 2} y={98} textAnchor="middle" fontSize={12} fill="var(--muted)" fontFamily="var(--font-mono)">
              {num(s.flow, s.flow < 1 ? 2 : 0)} {s.id === "storage" ? "t/h" : "m³/h"}
            </text>
            <text x={x + boxW / 2} y={118} textAnchor="middle" fontSize={12} fill="var(--muted)" fontFamily="var(--font-mono)">
              {num(s.pKpa, 1)} kPa · {num(s.tC, 1)} °C
            </text>
            <text x={x + boxW / 2} y={162} textAnchor="middle" fontSize={11} fill={on ? "var(--fluid-fg)" : "var(--muted)"} fontWeight={600}>
              {on ? "FLOWING" : "NO FLOW"}
            </text>
          </>
        );
        return onStage ? (
          <g key={s.id} role="button" tabIndex={0} onClick={() => onStage(s.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onStage(s.id)} className="cursor-pointer focus:outline-none [&:focus-visible>rect]:stroke-[var(--primary)]">
            {content}
          </g>
        ) : (
          <g key={s.id}>{content}</g>
        );
      })}
    </svg>
  );
}

