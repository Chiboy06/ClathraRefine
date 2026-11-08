"use client";
import { useMemo, useState } from "react";
import { FileDown, Sheet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, ErrorNote, Kpi, KpiRow, Page, Segmented, SimTag, download } from "@/components/ui";
import { DEPARTMENTS, PLANT } from "@/lib/demoData";
import { num } from "@/lib/format";

type Period = "daily" | "weekly";

function series(period: Period) {
  const n = period === "daily" ? 24 : 7;
  return Array.from({ length: n }, (_, i) => ({
    label: period === "daily" ? `${String(i).padStart(2, "0")}:00` : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
    captured: +((period === "daily" ? PLANT.captureKgH : PLANT.dailyCo2t * 1000) * (1 + 0.04 * Math.sin(i / 2))).toFixed(1),
    alarms: (i * 7) % 5 === 0 ? 1 : 0,
  }));
}

export default function Reports() {
  const [period, setPeriod] = useState<Period>("daily");
  const [err, setErr] = useState("");
  const data = useMemo(() => series(period), [period]);
  const total = data.reduce((s, d) => s + d.captured, 0);
  const csv = () => {
    const rows = [["period", "co2_captured_kg", "alarms"], ...data.map((d) => [d.label, d.captured, d.alarms])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clathra-${period}-summary.csv`;
    a.click();
  };
  return (
    <Page
      title="Reports"
      subtitle={<>Daily and weekly summaries from the DEMO scenario <SimTag kind="Demo" /></>}
      actions={
        <>
          <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} />
          <Button onClick={csv}>
            <Sheet aria-hidden className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="primary" onClick={() => download(`/api/pdf/report?period=${period}`, `report-${period}.pdf`).catch((e) => setErr(e.message))}>
            <FileDown aria-hidden className="h-4 w-4" /> Export PDF
          </Button>
        </>
      }
    >
      {err && <ErrorNote>{err}</ErrorNote>}
      <KpiRow>
        <Kpi label="CO2 captured" value={`${num(total / 1000, 2)} t`} tag={<SimTag />} />
        <Kpi label="Average capture rate" value={`${num(PLANT.captureKgH, 1)} kg/h`} tag={<SimTag />} />
        <Kpi label="Alarms" value={data.reduce((s, d) => s + d.alarms, 0)} tag={<SimTag kind="Demo" />} />
        <Kpi label="Departments reporting" value={DEPARTMENTS.length} />
      </KpiRow>
      <Card title={`CO2 captured per ${period === "daily" ? "hour (kg)" : "day (kg)"}`}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="var(--muted)" fontSize={11} />
              <YAxis stroke="var(--muted)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--fg)" }} />
              <Bar dataKey="captured" name="CO2 captured (kg)" fill="var(--fluid)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </Page>
  );
}
