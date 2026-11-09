"use client";
import type { Equipment } from "@/lib/sbo";
import type { PlantView } from "@/lib/plantView";
import { idw } from "@/lib/analytics";
import { num } from "@/lib/format";

export type Layers = { values: boolean; flow: boolean; alarms: boolean; heat: boolean; interlocks: boolean };

const SENSORS = {
  ambient: { x: 120, y: 95 },
  exhaust: { x: 270, y: 330 },
  co2In: { x: 390, y: 330 },
  co2Out: { x: 690, y: 90 },
};

/** Single-line style process mimic. Values on the equipment; fan and pump are clickable for select-before-operate. */
export function Mimic({ v, layers, selected, onSelect, interlocks }: { v: PlantView; layers: Layers; selected?: Equipment | null; onSelect: (e: Equipment) => void; interlocks: { fan: string | null; pump: string | null } }) {
  const ambAlarm = v.ambient.level !== "NORMAL";
  const gasFlow = layers.flow && v.fanOn;
  const liqFlow = layers.flow && v.pumpOn;
  const on = (b: boolean) => (b ? "var(--fluid)" : "var(--muted)");
  const heat: { x: number; y: number; v: number }[] = [
    { ...SENSORS.ambient, v: Math.min(1, v.ambient.mv / 2710) },
    { ...SENSORS.exhaust, v: Math.min(1, v.exhaustMv / 2710) * 0.6 },
    { x: 900, y: 470, v: 0.1 },
    { x: 60, y: 470, v: 0.1 },
  ];
  const equip = (eq: Equipment, label: string, x: number, y: number, isOn: boolean, extra: string | null) => (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${isOn ? "on" : "off"}. Select to operate`}
      onClick={() => onSelect(eq)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(eq)}
      className="cursor-pointer focus:outline-none"
      data-testid={`mimic-${eq}`}
    >
      <circle cx={x} cy={y} r={30} fill="var(--elev)" stroke={selected === eq ? "var(--primary)" : on(isOn)} strokeWidth={selected === eq ? 4 : 3} />
      {eq === "fan" ? (
        <g transform={`translate(${x} ${y})`} className={isOn ? "motion-safe:animate-spin" : undefined} style={{ transformBox: "fill-box", transformOrigin: "center", animationDuration: "1.2s" }}>
          {[0, 120, 240].map((a) => (
            <path key={a} d="M0 0 C 6 -8, 18 -12, 22 -4 C 14 -2, 6 0, 0 0" fill={on(isOn)} transform={`rotate(${a})`} />
          ))}
        </g>
      ) : (
        <path d={`M${x - 14} ${y + 12} L${x} ${y - 16} L${x + 14} ${y + 12} Z`} fill={on(isOn)} />
      )}
      <text x={x} y={y + 50} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--fg)">
        {label}
      </text>
      <text x={x} y={y + 66} textAnchor="middle" fontSize={12} fill={isOn ? "var(--fluid-fg)" : "var(--muted)"} fontWeight={600}>
        {isOn ? "RUNNING" : "STOPPED"}
      </text>
      {layers.interlocks && extra && (
        <text x={x} y={y + 82} textAnchor="middle" fontSize={11} fill="var(--warn-fg)">
          {extra}
        </text>
      )}
    </g>
  );
  const sensor = (label: string, tag: string, x: number, y: number, value: string, alarm: boolean) => (
    <g>
      {layers.alarms && alarm && <circle cx={x} cy={y} r={24} fill="none" stroke="var(--crit)" strokeWidth={3} className="motion-safe:animate-pulse" />}
      <rect x={x - 14} y={y - 14} width={28} height={28} rx={6} fill="var(--elev)" stroke={alarm ? "var(--crit)" : "var(--fg)"} strokeWidth={2} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--fg)">
        {tag.split("-")[0]}
      </text>
      <text x={x} y={y - 22} textAnchor="middle" fontSize={11} fill="var(--muted)">
        {tag} {label}
      </text>
      {layers.values && (
        <text x={x} y={y + 32} textAnchor="middle" fontSize={13} fontWeight={700} fill={alarm ? "var(--crit-fg)" : "var(--fg)"} fontFamily="var(--font-mono)">
          {value}
        </text>
      )}
    </g>
  );

  return (
    <svg viewBox="0 0 1000 520" className="h-auto w-full" role="group" aria-label="Process diagram: intake fan, duct with gas and CO2 sensors, packed absorption column, solvent tank and pump, outlet CO2 sensor and vent">
      <rect x={20} y={20} width={960} height={480} rx={16} fill="none" stroke="var(--line)" strokeDasharray="6 6" />
      <text x={36} y={44} fontSize={12} fill="var(--muted)">
        Plant room
      </text>

      {layers.heat && (
        <g aria-hidden>
          {Array.from({ length: 12 }, (_, i) =>
            Array.from({ length: 6 }, (_, j) => {
              const x = 20 + i * 80 + 40;
              const y = 20 + j * 80 + 40;
              const g = idw(heat, x, y);
              return <rect key={`${i}-${j}`} x={20 + i * 80} y={20 + j * 80} width={80} height={80} fill={g > 0.5 ? "var(--crit)" : g > 0.3 ? "var(--warn)" : "var(--ok)"} opacity={0.08 + g * 0.3} />;
            }),
          )}
          <text x={964} y={44} textAnchor="end" fontSize={11} fill="var(--muted)">
            Gas heat map: indicative, improves with more sensors
          </text>
        </g>
      )}

      {/* gas path: fan, duct, sensors, column, outlet, vent */}
      <path d="M180 330 H 520 V 400" fill="none" stroke={on(v.fanOn)} strokeWidth={8} strokeLinejoin="round" className={gasFlow ? "flow-line" : undefined} />
      <path d="M540 140 V 90 H 860" fill="none" stroke={on(v.fanOn)} strokeWidth={8} strokeLinejoin="round" className={gasFlow ? "flow-line" : undefined} />
      <path d="M860 70 L 900 90 L 860 110 Z" fill={on(v.fanOn)} />
      <text x={905} y={95} fontSize={12} fill="var(--muted)">
        Vent
      </text>

      {/* liquid loop: tank, pump, column spray, return */}
      <path d="M760 440 H 710 M 650 440 H 620 V 170 H 580" fill="none" stroke={on(v.pumpOn)} strokeWidth={5} className={liqFlow ? "flow-line" : undefined} />
      <path d="M580 420 H 760" fill="none" stroke={on(v.pumpOn)} strokeWidth={5} className={liqFlow ? "flow-line" : undefined} />

      {/* column */}
      <rect x={500} y={140} width={80} height={290} rx={14} fill="var(--elev)" stroke={v.scrubber === "SCRUBBING" ? "var(--fluid)" : "var(--fg)"} strokeWidth={3} />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1={510} x2={570} y1={190 + i * 36} y2={210 + i * 36} stroke="var(--line)" strokeWidth={2} />
      ))}
      <text x={540} y={465} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--fg)">
        Packed column
      </text>
      <text x={540} y={482} textAnchor="middle" fontSize={12} fill="var(--fluid-fg)" fontWeight={600}>
        {v.scrubber}
      </text>

      {/* tank */}
      <rect x={760} y={330} width={130} height={130} rx={12} fill="var(--elev)" stroke="var(--fg)" strokeWidth={3} />
      <rect x={762} y={460 - 1.26 * Math.min(100, v.loadingPct.value)} width={126} height={1.26 * Math.min(100, v.loadingPct.value)} rx={10} fill="var(--fluid)" opacity={0.25} />
      <text x={825} y={358} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--fg)">
        Solvent tank
      </text>
      {layers.values && (
        <>
          <text x={825} y={385} textAnchor="middle" fontSize={12} fill="var(--fg)" fontFamily="var(--font-mono)">
            {num(v.loadingPct.value, 0)}% loaded
          </text>
          <text x={825} y={403} textAnchor="middle" fontSize={12} fill="var(--fg)" fontFamily="var(--font-mono)">
            pH {num(v.ph.value, 2)}
          </text>
          <text x={825} y={421} textAnchor="middle" fontSize={12} fill="var(--fg)" fontFamily="var(--font-mono)">
            {num(v.solventC.value, 1)} °C
          </text>
          <text x={445} y={380} textAnchor="middle" fontSize={12} fill="var(--muted)" fontFamily="var(--font-mono)">
            {num(v.gasLpm.value, 2)} L/min gas
          </text>
          <text x={636} y={300} textAnchor="start" fontSize={12} fill="var(--muted)" fontFamily="var(--font-mono)">
            {num(v.liquidLpm.value, 2)} L/min solvent
          </text>
        </>
      )}

      {equip("fan", "Intake fan", 150, 330, v.fanOn, interlocks.fan)}
      {equip("pump", "Solvent pump", 680, 440, v.pumpOn, interlocks.pump)}

      {sensor("ambient gas", "AT-101", SENSORS.ambient.x, SENSORS.ambient.y, `${num(v.ambient.mv)} mV`, ambAlarm)}
      {sensor("exhaust gas", "AT-102", SENSORS.exhaust.x, SENSORS.exhaust.y, `${num(v.exhaustMv)} mV`, false)}
      {sensor("inlet CO2", "AT-103", SENSORS.co2In.x, SENSORS.co2In.y, `${num(v.co2InPpm.value)} ppm`, false)}
      {sensor("outlet CO2", "AT-104", SENSORS.co2Out.x, SENSORS.co2Out.y, `${num(v.co2OutPpm.value)} ppm`, false)}

      {v.critIn !== null && v.critIn > 0 && (
        <g data-testid="leak-countdown">
          <rect x={150} y={60} width={230} height={30} rx={15} fill="var(--crit)" />
          <text x={265} y={80} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">
            Hazard level in {v.critIn} s
          </text>
        </g>
      )}
    </svg>
  );
}
