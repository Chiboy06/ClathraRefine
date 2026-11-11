"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { cx } from "./ui";
import type { Tag } from "@/lib/tags";
import { lttb } from "@/lib/lttb";
import { formatTime } from "@/lib/format";

/** ISA-101 analogue indicator: value against range, normal band, alarm limits and trend direction. */
export function AnalogueBar({ tag, value, trend, label }: { tag: Pick<Tag, "min" | "max" | "normal" | "lo" | "hi" | "hihi" | "unit">; value: number; trend?: number; label?: string }) {
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - tag.min) / (tag.max - tag.min)) * 100));
  const out = (tag.hihi !== undefined && value >= tag.hihi) ? "crit" : (tag.hi !== undefined && value >= tag.hi) || (tag.lo !== undefined && value <= tag.lo) ? "warn" : "ok";
  const Arrow = trend === undefined || Math.abs(trend) < 1e-6 ? ArrowRight : trend > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex flex-col gap-1" aria-label={label ?? "Analogue value"}>
      <div className="relative h-3 rounded-sm bg-elev" role="meter" aria-valuemin={tag.min} aria-valuemax={tag.max} aria-valuenow={value} aria-label={label ?? "value against range"}>
        <div className="absolute inset-y-0 rounded-sm bg-fg/10" style={{ left: `${pct(tag.normal[0])}%`, width: `${pct(tag.normal[1]) - pct(tag.normal[0])}%` }} />
        {[tag.lo, tag.hi].map((l, i) => l !== undefined && <div key={i} className="absolute inset-y-[-3px] w-0.5 bg-warn" style={{ left: `${pct(l)}%` }} />)}
        {tag.hihi !== undefined && <div className="absolute inset-y-[-3px] w-0.5 bg-crit" style={{ left: `${pct(tag.hihi)}%` }} />}
        <div className={cx("absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm transition-[left] duration-200", out === "crit" ? "bg-crit" : out === "warn" ? "bg-warn" : "bg-fg")} style={{ left: `${pct(value)}%` }} />
      </div>
      <div className="flex items-center justify-between font-mono text-[11px] text-muted tabular">
        <span>{tag.min}</span>
        <span className="inline-flex items-center gap-1">
          <Arrow aria-hidden className="h-3 w-3" />
          {trend === undefined ? "steady" : trend > 0 ? "rising" : trend < 0 ? "falling" : "steady"}
        </span>
        <span>
          {tag.max} {tag.unit}
        </span>
      </div>
    </div>
  );
}

export type Series = { key: string; name: string; color: string };

/** Multi-series trend with alarm limits and event markers. Long ranges are LTTB-downsampled. */
export function TrendChart({ data, series, limits = [], markers = [], height = 260, unit, band }: { data: Record<string, number>[]; series: Series[]; limits?: { y: number; label: string; color: string }[]; markers?: { x: number; label: string }[]; height?: number; unit?: string; band?: [number, number] }) {
  const pts = useMemo(() => lttb(data, 400, (d) => d.t, (d) => d[series[0].key] ?? 0), [data, series]);
  if (!data.length) return <div className="flex items-center justify-center rounded-md border border-dashed border-line text-sm text-muted" style={{ height }}>No samples in this range yet</div>;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={pts} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => formatTime(v).slice(0, 5)} stroke="var(--muted)" fontSize={11} />
          <YAxis stroke="var(--muted)" fontSize={11} unit={unit} width={64} />
          <Tooltip labelFormatter={(v) => formatTime(Number(v))} contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--fg)", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {band && <ReferenceArea y1={band[0]} y2={band[1]} fill="var(--fg)" fillOpacity={0.04} />}
          {limits.map((l) => (
            <ReferenceLine key={l.label} y={l.y} stroke={l.color} strokeDasharray="4 4" label={{ value: l.label, fill: l.color, fontSize: 10, position: "insideTopRight" }} />
          ))}
          {markers.map((m, i) => (
            <ReferenceLine key={i} x={m.x} stroke="var(--muted)" label={{ value: m.label, fill: "var(--muted)", fontSize: 10, position: "insideTopLeft" }} />
          ))}
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} dot={false} strokeWidth={2} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Native dialog: focus trap, Escape to close and backdrop come from the platform. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="modal-title" className={cx("m-auto w-[calc(100%-2rem)] rounded-lg border border-line bg-panel p-0 text-fg", wide ? "max-w-3xl" : "max-w-lg")}>
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="modal-title" className="text-lg font-bold">
              {title}
            </h2>
            <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-elev hover:text-fg">
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** Right-side drawer built on the same native dialog. */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="drawer-title" className="m-0 ml-auto h-full max-h-full w-full max-w-md border-l border-line bg-panel p-0 text-fg">
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line p-6">
            <h2 id="drawer-title" className="text-lg font-bold">
              {title}
            </h2>
            <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-elev hover:text-fg">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export { useMe } from "./me";

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("font-mono tabular", className)}>{children}</span>;
}

/** Copy-to-clipboard for hashes and IDs. */
export function CopyText({ text, short = 12 }: { text: string; short?: number }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => setDone(true))}
      aria-label={`${text.slice(0, short)}… ${done ? "copied" : "copy"}: ${text}`}
      className="font-mono text-xs text-primary-fg underline-offset-2 hover:underline"
      title={text}
    >
      {text.slice(0, short)}… {done ? "copied" : "copy"}
    </button>
  );
}

export function useInterval(fn: () => void, ms: number) {
  const saved = useRef(fn);
  useEffect(() => {
    saved.current = fn;
  });
  useEffect(() => {
    const t = setInterval(() => saved.current(), ms);
    return () => clearInterval(t);
  }, [ms]);
}
