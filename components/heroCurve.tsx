"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ScenarioSource } from "@/lib/telemetry/sources";
import { FW } from "@/lib/process";

// Hero timeline in seconds. The scenario's leak starts at LEAK_AT; extraction starts once the forecast
// first predicts a trip, at ACT_AT, and the reading bends back down. The forecast runs 30 s ahead.
const END = 60;
const STOP = 38;
const LEAK_AT = 20;
const ACT_AT = 24;
const HORIZON = 30;
const W = 800;
const H = 320;
const PAD = { l: 8, r: 8, t: 16, b: 24 };
const Y_MAX = 3200;

function useProfiles() {
  return useMemo(() => {
    const s = new ScenarioSource();
    s.triggerLeak();
    const base = 200_000; // the scenario's uptime when the leak was triggered
    const raw = (t: number) => s.ambientAt(base + (t - LEAK_AT) * 1000, Math.round(t / 2));
    const atAct = raw(ACT_AT);
    const baseline = raw(0);
    // After extraction starts the reading decays towards baseline instead of following the leak.
    const mitigated = (t: number) => (t <= ACT_AT ? raw(t) : baseline + (atAct - baseline) * Math.exp(-(t - ACT_AT) / 5));
    return { raw, mitigated };
  }, []);
}

const x = (t: number) => PAD.l + (t / END) * (W - PAD.l - PAD.r);
const y = (v: number) => PAD.t + (1 - v / Y_MAX) * (H - PAD.t - PAD.b);
const path = (pts: [number, number][]) => pts.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

export function HeroCurve() {
  const { raw, mitigated } = useProfiles();
  const [now, setNow] = useState(STOP);
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let start = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (ref.current) io.observe(ref.current);
    const loop = (ts: number) => {
      if (!start) start = ts;
      const elapsed = (ts - start) / 1000;
      const cycle = 12; // 9 s of motion, then a 3 s hold on the outcome
      const phase = elapsed % cycle;
      if (visible) setNow(Math.min(STOP, (phase / 9) * STOP));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  const step = 0.5;
  const reading: [number, number][] = [];
  for (let t = 0; t <= now; t += step) reading.push([t, mitigated(t)]);
  // Before the action the forecast follows the leak; after it, it follows the mitigated path.
  const future = now < ACT_AT ? raw : mitigated;
  const forecast: [number, number][] = [];
  for (let t = now; t <= Math.min(END, now + HORIZON); t += step) forecast.push([t, future(t)]);
  const crossing = forecast.find(([, v]) => v >= FW.AMB_CRIT_ON_MV);
  const prevented = now >= ACT_AT + 4;
  const nowV = mitigated(now);

  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="A gas reading starts to rise. The 30 second forecast reaches the trip threshold first, extraction starts, the forecast bends back down and the leak is prevented before any alarm.">
        <line x1={PAD.l} x2={W - PAD.r} y1={y(FW.AMB_CRIT_ON_MV)} y2={y(FW.AMB_CRIT_ON_MV)} stroke="var(--crit)" strokeWidth="1.5" strokeDasharray="5 5" />
        <text x={W - PAD.r} y={y(FW.AMB_CRIT_ON_MV) - 8} textAnchor="end" fontSize="13" fill="var(--crit-fg)" fontWeight="600">
          Trip threshold
        </text>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(FW.AMB_WARN_ON_MV)} y2={y(FW.AMB_WARN_ON_MV)} stroke="var(--warn)" strokeWidth="1.5" strokeDasharray="5 5" />
        <text x={W - PAD.r} y={y(FW.AMB_WARN_ON_MV) - 8} textAnchor="end" fontSize="13" fill="var(--warn-fg)" fontWeight="600">
          Warning
        </text>
        <path d={path(forecast)} stroke="var(--primary)" strokeWidth="3" fill="none" strokeDasharray="8 7" strokeLinecap="round" />
        <path d={path(reading)} stroke="var(--fg)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <line x1={x(now)} x2={x(now)} y1={PAD.t} y2={H - PAD.b} stroke="var(--line)" strokeWidth="1.5" />
        <circle cx={x(now)} cy={y(nowV)} r="7" fill="var(--panel)" stroke="var(--fg)" strokeWidth="3" />
        {crossing && (
          <g>
            <circle cx={x(crossing[0])} cy={y(FW.AMB_CRIT_ON_MV)} r="6" fill="var(--crit)" />
            <text x={Math.min(x(crossing[0]), W - 190)} y={y(FW.AMB_CRIT_ON_MV) + 26} fontSize="14" fill="var(--crit-fg)" fontWeight="600">
              Predicted crossing in {Math.max(0, Math.round(crossing[0] - now))} s
            </text>
          </g>
        )}
        <text x={PAD.l} y={H - 6} fontSize="12" fill="var(--muted)">
          Reading
        </text>
        <text x={x(now) + 8} y={H - 6} fontSize="12" fill="var(--primary-fg)">
          30 s forecast
        </text>
      </svg>
      <div className={`absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-opacity duration-200 ${prevented ? "border-ok/50 bg-ok-bg text-ok-fg opacity-100" : "opacity-0"}`} aria-hidden={!prevented}>
        <ShieldCheck aria-hidden className="h-4 w-4" /> Prevented: extraction started before the alarm
      </div>
    </div>
  );
}
