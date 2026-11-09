"use client";
import { Button, Card, Kpi, KpiRow, LoadingPanel, Page, SimTag } from "@/components/ui";
import { TrendChart } from "@/components/scada";
import { usePlant } from "@/lib/telemetry/usePlant";
import { getHub } from "@/lib/telemetry/hub";
import { breakthroughSeries, solventOutlook } from "@/lib/plantView";
import { num } from "@/lib/format";

export default function SolventForecast() {
  const p = usePlant();
  if (!p.ready) return <Page title="Solvent forecast"><LoadingPanel rows={4} /></Page>;
  const f = solventOutlook(p);
  const pts = breakthroughSeries(p);
  const t0 = p.history[0]?.receivedAt ?? 0;
  return (
    <Page
      title="Solvent forecast"
      subtitle="When the solvent will saturate, from the outlet/inlet CO2 ratio."
      actions={p.mode === "DEMO" && <Button onClick={() => getHub().replaceSolvent()}>Replace solvent (Demo)</Button>}
    >
      <KpiRow>
        <Kpi label="Time to 50% breakthrough" value={f.minutes === null ? "Not rising" : f.minutes === 0 ? "Saturated" : `${f.minutes} min`} sub="Linear fit of the breakthrough trend" />
        <Kpi label="Breakthrough now" value={`${num(f.now * 100, 0)}%`} sub="Outlet CO2 as a share of inlet" />
        <Kpi label="Solvent loading" value={`${num(p.solventLoadingPct, 0)}%`} sub="Of 0.55 g CO2 per litre" tag={<SimTag />} />
        <Kpi label="Model" value="Trend fit v1" sub="Advisory" />
      </KpiRow>
      <Card title="Breakthrough trend" help="Scrubbing readings only. The forecast fits a straight line to the recent ratio and finds where it reaches 50%.">
        <TrendChart data={pts.map((x) => ({ t: t0 + x.tMin * 60_000, ratio: +(x.ratio * 100).toFixed(1) }))} unit=" %" series={[{ key: "ratio", name: "Outlet / inlet CO2", color: "var(--warn)" }]} limits={[{ y: 50, label: "50% breakthrough", color: "var(--crit)" }]} />
      </Card>
    </Page>
  );
}
