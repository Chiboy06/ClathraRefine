"use client";
import type { Equipment } from "@/lib/sbo";
import type { PlantView } from "@/lib/plantView";
import { idw } from "@/lib/analytics";
import { num } from "@/lib/format";

export type Layers = { values: boolean; flow: boolean; alarms: boolean; heat: boolean; interlocks: boolean };

// Single-line schematic in control-room style: always dark, whatever the console theme, so state colours read the same.
const C = {
  bg: "#0b1016",
  line: "#cfd6de",
  dim: "#5d6875",
  box: "#4a5562",
  text: "#e6edf3",
  muted: "#9aa5b1",
  gas: "#2fbf71",
  liquid: "#38bdf8",
  warn: "#f59e0b",
  crit: "#ef4444",
  sel: "#60a5fa",
};

const SENSORS = {
  ambient: { x: 895, y: 150 },
  exhaust: { x: 245, y: 320 },
  co2In: { x: 335, y: 320 },
  co2Out: { x: 640, y: 150 },
};

/** Dotted section boundary with its title, as on a switchgear single-line diagram. */
function Section({ x, y, w, h, title }: { x: number; y: number; w: number; h: number; title: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={C.box} strokeDasharray="2 4" />
      <text x={x + w / 2} y={y + 16} textAnchor="middle" fontSize={11} fontWeight={700} letterSpacing={0.6} fill={C.text}>
        {title}
      </text>
    </g>
  );
}

/** Process diagram of the capture skid. Values on the instruments; fan and pump are clickable for select-before-operate. */
export function Mimic({ v, layers, selected, onSelect, interlocks }: { v: PlantView; layers: Layers; selected?: Equipment | null; onSelect: (e: Equipment) => void; interlocks: { fan: string | null; pump: string | null } }) {
  const ambAlarm = v.ambient.level !== "NORMAL";
  const gasFlow = layers.flow && v.fanOn;
  const liqFlow = layers.flow && v.pumpOn;
  const gasStroke = v.fanOn ? C.gas : C.dim;
  const liqStroke = v.pumpOn ? C.liquid : C.dim;
  const heat: { x: number; y: number; v: number }[] = [
    { ...SENSORS.ambient, v: Math.min(1, v.ambient.mv / 2710) },
    { ...SENSORS.exhaust, v: Math.min(1, v.exhaustMv / 2710) * 0.6 },
    { x: 960, y: 480, v: 0.1 },
    { x: 40, y: 480, v: 0.1 },
  ];

  // Instrument: square box with a state flag in the corner, tag above, live value below.
  const meter = (tag: string, name: string, x: number, y: number, value: string, alarm: boolean) => (
    <g>
      {layers.alarms && alarm && <rect x={x - 21} y={y - 21} width={42} height={42} fill="none" stroke={C.crit} strokeWidth={2} className="motion-safe:animate-pulse" />}
      <rect x={x - 14} y={y - 14} width={28} height={28} fill={C.bg} stroke={alarm ? C.crit : C.line} strokeWidth={1.5} />
      <path d={`M${x - 14} ${y - 14} h10 L${x - 14} ${y - 4} Z`} fill={alarm ? C.crit : C.gas} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={9} fontWeight={700} fill={C.text}>
        AT
      </text>
      <text x={x} y={y + 46} textAnchor="middle" fontSize={10} fill={C.muted}>
        {tag} {name}
      </text>
      {layers.values && (
        <text x={x} y={y + 30} textAnchor="middle" fontSize={12} fontWeight={700} fill={alarm ? C.crit : C.text} fontFamily="var(--font-mono)">
          {value}
        </text>
      )}
    </g>
  );

  // The button holds only the symbol; labels sit beside it so the accessible name never conflicts with visible text.
  const equip = (eq: Equipment, label: string, x: number, y: number, isOn: boolean, extra: string | null) => (
    <g key={eq}>
      <g
        role="button"
        tabIndex={0}
        aria-label={`${label} ${isOn ? "RUNNING" : "STOPPED"}${layers.interlocks && extra ? ` ${extra}` : ""}. Select to operate`}
        onClick={() => onSelect(eq)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(eq)}
        className="cursor-pointer focus:outline-none"
        data-testid={`mimic-${eq}`}
      >
        {selected === eq && <rect x={x - 32} y={y - 32} width={64} height={64} fill="none" stroke={C.sel} strokeWidth={2} strokeDasharray="4 3" />}
        <circle cx={x} cy={y} r={22} fill={C.bg} stroke={isOn ? (eq === "fan" ? C.gas : C.liquid) : C.line} strokeWidth={2} />
        {eq === "fan" ? (
          // Position on the outer group: a CSS spin on the same element would replace the SVG translate.
          <g transform={`translate(${x} ${y})`}>
            <g className={isOn ? "motion-safe:animate-spin" : undefined} style={{ transformBox: "view-box", transformOrigin: "0 0", animationDuration: "1.2s" }}>
              {[0, 120, 240].map((a) => (
                <path key={a} d="M0 0 C 4 -6, 13 -9, 16 -3 C 10 -1, 4 0, 0 0" fill={isOn ? C.gas : C.line} transform={`rotate(${a})`} />
              ))}
            </g>
          </g>
        ) : (
          // Centrifugal pump: casing circle with a tangential discharge.
          <path d={`M${x - 10} ${y + 8} L${x} ${y - 12} L${x + 10} ${y + 8} Z`} fill={isOn ? C.liquid : C.line} />
        )}
      </g>
      <g aria-hidden onClick={() => onSelect(eq)} className="cursor-pointer">
        <text x={x} y={y + 38} textAnchor="middle" fontSize={11} fontWeight={600} fill={C.text}>
          {label}
        </text>
        <text x={x} y={y + 52} textAnchor="middle" fontSize={10} fontWeight={700} fill={isOn ? C.gas : C.muted}>
          {isOn ? "RUNNING" : "STOPPED"}
        </text>
        {layers.interlocks && extra && (
          <text x={x} y={y + 66} textAnchor="middle" fontSize={10} fill={C.warn}>
            {extra}
          </text>
        )}
      </g>
    </g>
  );

  const rows: [string, string][] = [
    ["AT-101 ambient", `${num(v.ambient.mv)} mV`],
    ["AT-102 exhaust", `${num(v.exhaustMv)} mV`],
    ["AT-103 CO2 in", `${num(v.co2InPpm.value)} ppm`],
    ["AT-104 CO2 out", `${num(v.co2OutPpm.value)} ppm`],
    ["CO2 removed", `${num(v.reductionPct.value, 1)} %`],
    ["Gas flow", `${num(v.gasLpm.value, 2)} L/min`],
    ["Solvent flow", `${num(v.liquidLpm.value, 2)} L/min`],
    ["Solvent loading", `${num(v.loadingPct.value, 0)} %`],
    ["Solvent pH", num(v.ph.value, 2)],
    ["Solvent temperature", `${num(v.solventC.value, 1)} °C`],
  ];

  return (
    <svg viewBox="0 0 1000 540" className="h-auto w-full rounded-xl" role="group" aria-label="Process diagram: intake fan, duct with gas and CO2 sensors, packed absorption column, solvent tank and pump, outlet CO2 sensor and vent">
      <rect width={1000} height={540} fill={C.bg} />
      <text x={24} y={30} fontSize={13} fontWeight={800} letterSpacing={1} fill={C.text}>
        CAPTURE SKID
      </text>
      <text x={976} y={30} textAnchor="end" fontSize={10} fill={C.muted}>
        Scrubber {v.scrubber} · Control {v.boardMode}
      </text>

      {layers.heat && (
        <g aria-hidden>
          {Array.from({ length: 12 }, (_, i) =>
            Array.from({ length: 6 }, (_, j) => {
              const x = 20 + i * 80 + 40;
              const y = 40 + j * 80 + 40;
              const g = idw(heat, x, y);
              return <rect key={`${i}-${j}`} x={20 + i * 80} y={40 + j * 80} width={80} height={80} fill={g > 0.5 ? C.crit : g > 0.3 ? C.warn : C.gas} opacity={0.04 + g * 0.22} />;
            }),
          )}
          <text x={976} y={530} textAnchor="end" fontSize={10} fill={C.muted}>
            Gas heat map: indicative, improves with more sensors
          </text>
        </g>
      )}

      <Section x={24} y={190} w={330} h={200} title="INTAKE" />
      <Section x={370} y={50} w={160} h={460} title="ABSORPTION" />
      <Section x={546} y={50} w={290} h={200} title="DISCHARGE" />
      <Section x={546} y={270} w={290} h={240} title="SOLVENT LOOP" />
      <Section x={852} y={50} w={124} h={200} title="ROOM" />

      {/* Process gas header: fan, duct sensors, column inlet. */}
      <path d="M142 250 H 410 V 440" fill="none" stroke={gasStroke} strokeWidth={3} className={gasFlow ? "flow-line" : undefined} />
      <line x1={245} y1={250} x2={245} y2={306} stroke={C.line} strokeWidth={1.2} />
      <line x1={335} y1={250} x2={335} y2={306} stroke={C.line} strokeWidth={1.2} />
      {/* Treated gas: column top, outlet sensor, vent. */}
      <path d="M450 100 V 80 H 790" fill="none" stroke={gasStroke} strokeWidth={3} className={gasFlow ? "flow-line" : undefined} />
      <line x1={640} y1={80} x2={640} y2={136} stroke={C.line} strokeWidth={1.2} />
      <path d="M790 68 L 812 80 L 790 92 Z" fill={gasStroke} />
      <text x={790} y={110} textAnchor="middle" fontSize={10} fill={C.muted}>
        Vent
      </text>

      {/* Packed column with packing hatch. */}
      <rect x={410} y={100} width={80} height={340} fill={C.bg} stroke={v.scrubber === "SCRUBBING" ? C.liquid : C.line} strokeWidth={2} />
      {Array.from({ length: 7 }, (_, i) => (
        <path key={i} d={`M412 ${150 + i * 38} L 488 ${180 + i * 38} M488 ${150 + i * 38} L 412 ${180 + i * 38}`} stroke={C.box} strokeWidth={1} />
      ))}
      <text x={450} y={462} textAnchor="middle" fontSize={11} fontWeight={600} fill={C.text}>
        Packed column
      </text>
      <text x={450} y={477} textAnchor="middle" fontSize={10} fontWeight={700} fill={v.scrubber === "SCRUBBING" ? C.liquid : C.muted}>
        {v.scrubber}
      </text>

      {/* Solvent loop: tank, pump, spray to column top, return from column bottom. */}
      <path d="M700 420 H 600 M 600 420 H 520 V 120 H 490" fill="none" stroke={liqStroke} strokeWidth={2} className={liqFlow ? "flow-line" : undefined} />
      <path d="M490 425 H 505 V 492 H 740 V 470" fill="none" stroke={liqStroke} strokeWidth={2} className={liqFlow ? "flow-line" : undefined} />
      <rect x={700} y={330} width={100} height={140} fill={C.bg} stroke={C.line} strokeWidth={1.5} />
      <rect x={701} y={469 - 1.38 * Math.min(100, v.loadingPct.value)} width={98} height={1.38 * Math.min(100, v.loadingPct.value)} fill={C.liquid} opacity={0.18} />
      <text x={750} y={348} textAnchor="middle" fontSize={11} fontWeight={600} fill={C.text}>
        Solvent tank
      </text>
      {layers.values && (
        <>
          <text x={750} y={372} textAnchor="middle" fontSize={11} fill={C.text} fontFamily="var(--font-mono)">
            {num(v.loadingPct.value, 0)}% loaded
          </text>
          <text x={750} y={388} textAnchor="middle" fontSize={11} fill={C.text} fontFamily="var(--font-mono)">
            pH {num(v.ph.value, 2)}
          </text>
          <text x={750} y={404} textAnchor="middle" fontSize={11} fill={C.text} fontFamily="var(--font-mono)">
            {num(v.solventC.value, 1)} °C
          </text>
          <text x={255} y={242} textAnchor="middle" fontSize={10} fill={C.muted} fontFamily="var(--font-mono)">
            {num(v.gasLpm.value, 2)} L/min gas
          </text>
          <text x={530} y={300} fontSize={10} fill={C.muted} fontFamily="var(--font-mono)" transform="rotate(90 530 300)">
            {num(v.liquidLpm.value, 2)} L/min solvent
          </text>
        </>
      )}

      {equip("fan", "Intake fan", 120, 250, v.fanOn, interlocks.fan)}
      {equip("pump", "Solvent pump", 620, 420, v.pumpOn, interlocks.pump)}

      {meter("AT-101", "ambient gas", SENSORS.ambient.x, SENSORS.ambient.y, `${num(v.ambient.mv)} mV`, ambAlarm)}
      {meter("AT-102", "exhaust gas", SENSORS.exhaust.x, SENSORS.exhaust.y, `${num(v.exhaustMv)} mV`, false)}
      {meter("AT-103", "inlet CO2", SENSORS.co2In.x, SENSORS.co2In.y, `${num(v.co2InPpm.value)} ppm`, false)}
      {meter("AT-104", "outlet CO2", SENSORS.co2Out.x, SENSORS.co2Out.y, `${num(v.co2OutPpm.value)} ppm`, false)}

      {/* Tag table, as on a control-room overview. */}
      <g>
        <rect x={24} y={410} width={330} height={100} fill="#111821" stroke={C.box} />
        {rows.map(([k, val], i) => (
          <g key={k}>
            <text x={34 + (i >= 5 ? 165 : 0)} y={428 + (i % 5) * 17} fontSize={10} fill={C.muted}>
              {k}
            </text>
            <text x={186 + (i >= 5 ? 165 : 0)} y={428 + (i % 5) * 17} textAnchor="end" fontSize={10} fontWeight={700} fill={C.text} fontFamily="var(--font-mono)">
              {val}
            </text>
          </g>
        ))}
      </g>

      {v.critIn !== null && v.critIn > 0 && (
        <g data-testid="leak-countdown">
          <rect x={150} y={56} width={200} height={26} fill={C.crit} />
          <text x={250} y={74} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
            Hazard level in {v.critIn} s
          </text>
        </g>
      )}
    </svg>
  );
}
