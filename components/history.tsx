"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Empty, Page, Segmented, Table, Td, inputCls } from "./ui";
import { useSeries } from "./trends";
import { usePlant } from "@/lib/telemetry/usePlant";
import { bucket, type Point } from "@/lib/series";
import { num } from "@/lib/format";

type Period = "day" | "month" | "year" | "custom";
type Kind = "co2" | "gas" | "alarms";
const DAY = 86_400_000;

function periodWindow(period: Period, anchor: number, custom: { from: string; to: string }) {
  const d = new Date(anchor);
  if (period === "day") {
    const from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return { from, to: from + DAY - 1, key: (t: number) => Math.floor(t / 3_600_000) * 3_600_000, fmt: (t: number) => `${String(new Date(t).getUTCHours()).padStart(2, "0")}:00` };
  }
  if (period === "month") {
    const from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    return { from, to: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1, key: (t: number) => Math.floor(t / DAY) * DAY, fmt: (t: number) => String(new Date(t).getUTCDate()) };
  }
  if (period === "year") {
    const from = Date.UTC(d.getUTCFullYear(), 0, 1);
    return { from, to: Date.UTC(d.getUTCFullYear() + 1, 0, 1) - 1, key: (t: number) => Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), 1), fmt: (t: number) => new Date(t).toLocaleString("en-GB", { month: "short", timeZone: "UTC" }) };
  }
  const from = Date.parse(custom.from) || anchor - 7 * DAY;
  const to = (Date.parse(custom.to) || anchor) + DAY - 1;
  return { from, to, key: (t: number) => Math.floor(t / DAY) * DAY, fmt: (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }) };
}

function step(period: Period, anchor: number, dir: 1 | -1) {
  const d = new Date(anchor);
  if (period === "day") return anchor + dir * DAY;
  if (period === "month") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1);
  return Date.UTC(d.getUTCFullYear() + dir, 0, 1);
}

const COLS: Record<Kind, { key: keyof Point; label: string; dp: number; bar?: boolean }[]> = {
  co2: [
    { key: "co2_in", label: "Inlet CO2 (ppm)", dp: 0 },
    { key: "co2_out", label: "Outlet CO2 (ppm)", dp: 0 },
    { key: "reduction", label: "Reduction (%)", dp: 1 },
    { key: "captured_g", label: "CO2 captured (g)", dp: 2, bar: true },
  ],
  gas: [
    { key: "ambient", label: "Ambient gas (mV)", dp: 0 },
    { key: "exhaust", label: "Exhaust gas (mV)", dp: 0 },
    { key: "alarms", label: "Alarms", dp: 0, bar: true },
  ],
  alarms: [{ key: "alarms", label: "Alarms", dp: 0, bar: true }],
};
const COLORS = ["var(--warn)", "var(--fluid)", "var(--ok)", "var(--primary)"];

export function HistoryView({ kind, title, subtitle }: { kind: Kind; title: string; subtitle: string }) {
  const p = usePlant();
  const [period, setPeriod] = useState<Period>("day");
  const [anchor, setAnchor] = useState<number | null>(null);
  const [custom, setCustom] = useState({ from: "", to: "" });
  const at = anchor ?? p.now ?? 0;
  const w = periodWindow(period, at, custom);
  const { points, source } = useSeries(w.from, w.to);
  const rows = useMemo(() => bucket(points, w.key), [points, w]);
  const cols = COLS[kind];
  const label = period === "day" ? new Date(w.from).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }) : period === "month" ? new Date(w.from).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : period === "year" ? String(new Date(w.from).getUTCFullYear()) : "Custom range";

  return (
    <Page title={title} subtitle={subtitle}>
      <Card
        help={`Source: ${source}. Times are UTC.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: "day", label: "Day" }, { value: "month", label: "Month" }, { value: "year", label: "Year" }, { value: "custom", label: "Custom" }]} />
            {period === "custom" ? (
              <>
                <label className="sr-only" htmlFor="h-from">From</label>
                <input id="h-from" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className={inputCls + " w-40"} />
                <label className="sr-only" htmlFor="h-to">To</label>
                <input id="h-to" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className={inputCls + " w-40"} />
              </>
            ) : (
              <div className="flex items-center gap-1">
                <button onClick={() => setAnchor(step(period, at, -1))} aria-label="Previous" className="rounded-lg border border-line p-2 hover:bg-elev">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-36 text-center text-sm font-semibold">{label}</span>
                <button onClick={() => setAnchor(step(period, at, 1))} aria-label="Next" className="rounded-lg border border-line p-2 hover:bg-elev">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        }
      >
        {!rows.length ? (
          <Empty title="No history for this period">Readings appear here once the device has reported. Pick another period or check Connect a device.</Empty>
        ) : (
          <div className="h-80">
            <ResponsiveContainer>
              <ComposedChart data={rows}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={w.fmt} stroke="var(--muted)" fontSize={11} />
                <YAxis yAxisId="l" stroke="var(--muted)" fontSize={11} width={56} />
                <YAxis yAxisId="r" orientation="right" stroke="var(--muted)" fontSize={11} width={48} />
                <Tooltip labelFormatter={(t) => w.fmt(Number(t))} contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--fg)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {cols.map((c, i) =>
                  c.bar ? (
                    <Bar key={c.key} yAxisId={cols.length > 1 ? "r" : "l"} dataKey={c.key} name={c.label} fill={COLORS[i]} opacity={0.6} isAnimationActive={false} />
                  ) : (
                    <Line key={c.key} yAxisId="l" dataKey={c.key} name={c.label} stroke={COLORS[i]} dot={false} strokeWidth={2} isAnimationActive={false} />
                  ),
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      {!!rows.length && (
        <Card title="Data">
          <Table head={["Time (UTC)", ...cols.map((c) => c.label)]} caption={`${title} data`}>
            {rows.map((r) => (
              <tr key={r.t}>
                <Td mono>{w.fmt(r.t)}</Td>
                {cols.map((c) => (
                  <Td key={c.key} mono>
                    {r[c.key] === undefined ? "-" : num(r[c.key] as number, c.dp)}
                  </Td>
                ))}
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {kind === "co2" && (
        <p className="text-sm text-muted">
          Related: <Link href="/app/capture" className="font-semibold text-primary-fg hover:underline">capture lots</Link> and <Link href="/app/departments" className="font-semibold text-primary-fg hover:underline">departments and quota</Link>.
        </p>
      )}
    </Page>
  );
}
