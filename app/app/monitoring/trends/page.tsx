"use client";
import { useState } from "react";
import { Card, Page, Segmented } from "@/components/ui";
import { TrendChart } from "@/components/scada";
import { RANGES, SignalPicker, useSeries, type Range } from "@/components/trends";
import { usePlant } from "@/lib/telemetry/usePlant";
import { SIGNALS } from "@/lib/series";

const COLORS = ["var(--primary)", "var(--fluid)", "var(--warn)", "var(--ok)", "var(--crit)", "var(--shop)", "var(--muted)", "var(--fg)", "var(--slate)"];

export default function LiveTrends() {
  const p = usePlant();
  const [sel, setSel] = useState<string[]>(["co2_in", "co2_out"]);
  const [range, setRange] = useState<Range>("15m");
  const { points } = useSeries((p.now || 0) - RANGES[range], p.now || 0);
  return (
    <Page title="Live trends" subtitle="Plot any signals together.">
      <Card actions={<Segmented label="Range" value={range} onChange={setRange} options={(Object.keys(RANGES) as Range[]).map((r) => ({ value: r, label: r === "15m" ? "15 min" : r }))} />}>
        <SignalPicker value={sel} onChange={setSel} />
        <div className="mt-6">
          <TrendChart height={380} data={points as unknown as Record<string, number>[]} series={sel.map((k, i) => ({ key: k, name: `${SIGNALS[k].label} (${SIGNALS[k].unit})`, color: COLORS[i % COLORS.length] }))} />
        </div>
      </Card>
    </Page>
  );
}
