"use client";
import { Badge, Card, Kpi, KpiRow, LoadingPanel, Notice, Page, SimTag } from "@/components/ui";
import { TrendChart } from "@/components/scada";
import { usePlant } from "@/lib/telemetry/usePlant";
import { FEATURES, capturePoints, deterioration, fitCapture, predictRemoval, recommend } from "@/lib/capture";
import { num } from "@/lib/format";

const STATUS = {
  ok: { tone: "ok", label: "Performing" },
  watch: { tone: "warn", label: "Watch" },
  deteriorating: { tone: "crit", label: "Deteriorating" },
} as const;

export default function CapturePerformance() {
  const p = usePlant();
  if (!p.ready) return <Page title="Capture performance"><LoadingPanel rows={5} /></Page>;
  const pts = capturePoints(p.history);
  const m = fitCapture(pts);
  const rec = m && recommend(m, pts);
  const det = deterioration(pts);
  const sim = p.mode === "DEMO" ? <SimTag /> : undefined;
  const maxInf = m ? Math.max(...FEATURES.map((f) => Math.abs(m.influence[f.key])), 0.01) : 1;

  return (
    <Page title="Capture performance" subtitle="What drives CO2 removal on this skid, the settings that improve it, and early warning when it falls. Advisory: nothing here operates the plant.">
      {!m && (
        <Notice tone="neutral">
          Learning needs {Math.max(0, 30 - pts.length)} more scrubbing readings with inlet and outlet CO2, gas and solvent flow, solvent temperature and pH. {pts.length} collected so far.
        </Notice>
      )}

      <KpiRow>
        <Kpi label="CO2 removal now" value={pts.length ? `${num(pts.at(-1)!.removal, 1)}%` : "No data"} sub="Inlet against outlet CO2" tag={sim} />
        <Kpi label="Health" value={det ? STATUS[det.status].label : "Learning"} sub={det ? `${det.drop > 0 ? "Down" : "Up"} ${num(Math.abs(det.drop), 1)} points on the start of the window` : "Needs 45 readings"} />
        <Kpi label="Best achievable" value={rec ? `${num(rec.predicted, 1)}%` : "Learning"} sub={rec ? `${rec.gain > 0.5 ? "+" + num(rec.gain, 1) + " points with the settings below" : "Already near the best seen"}` : "From the conditions this plant has run at"} />
        <Kpi label="Model fit" value={m ? `R² ${num(m.r2, 2)}` : "Learning"} sub={m ? `Ridge regression on ${m.n} readings` : "Retrains on every reading"} />
      </KpiRow>

      {det && det.status !== "ok" && (
        <Card title="Performance deterioration" tone={det.status === "deteriorating" ? "crit" : "warn"} help="Recent removal compared with the start of the window. Causes are ranked by how strongly the data points to each one.">
          <p className="mb-4 text-sm">
            Removal fell from <span className="font-mono font-semibold">{num(det.reference, 1)}%</span> to <span className="font-mono font-semibold">{num(det.recent, 1)}%</span>. Likely causes:
          </p>
          <ol className="flex flex-col gap-3">
            {det.causes.map((c, i) => (
              <li key={c.id} className="flex items-start gap-3 rounded-lg border border-line bg-elev p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-panel font-mono text-xs font-bold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {c.title} <Badge tone={c.score > 0.7 ? "crit" : "warn"}>{c.score > 0.7 ? "Strong" : "Possible"}</Badge>
                  </div>
                  <p className="text-sm text-muted">{c.evidence}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="What drives removal" help="Change in removal, in percentage points, when each condition rises by one typical step (one standard deviation). Learned from this skid's own readings.">
          {m ? (
            <ul className="flex flex-col gap-3" aria-label="Influence on CO2 removal">
              {FEATURES.map((f) => {
                const v = m.influence[f.key];
                const w = (Math.abs(v) / maxInf) * 50;
                return (
                  <li key={f.key} className="grid grid-cols-[10rem_1fr_4.5rem] items-center gap-3 text-sm">
                    <span>{f.label}</span>
                    <span className="relative h-2.5 rounded-full bg-elev" aria-hidden>
                      <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                      <span className={v >= 0 ? "absolute inset-y-0 rounded-full bg-ok" : "absolute inset-y-0 rounded-full bg-crit"} style={v >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
                    </span>
                    <span className="text-right font-mono tabular">{v >= 0 ? "+" : ""}{num(v, 1)} pts</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">Shown once the model has learned from 30 readings.</p>
          )}
        </Card>

        <Card title="Recommended operating conditions" help="The best predicted removal within the range this plant has already run at. It never suggests conditions outside what was observed. Changes are made by an operator from the process diagram.">
          {rec ? (
            rec.actions.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {rec.actions.map((a) => (
                  <li key={a} className="rounded-lg border border-line bg-elev px-3 py-2">{a}</li>
                ))}
                <li className="pt-1 text-muted">Predicted removal {num(rec.now, 1)}% now, {num(rec.predicted, 1)}% with these changes.</li>
              </ul>
            ) : (
              <p className="text-sm">Current conditions are already at the best this plant has achieved. No change needed.</p>
            )
          ) : (
            <p className="text-sm text-muted">Shown once the model has learned from 30 readings.</p>
          )}
        </Card>
      </div>

      {m && (
        <Card title="Measured against expected removal" help="The gap between the two lines is performance the operating conditions do not explain, such as solvent ageing or a sensor fault.">
          <TrendChart
            data={pts.slice(-300).map((x) => ({ t: x.t, actual: +x.removal.toFixed(1), expected: +predictRemoval(m, x).toFixed(1) }))}
            unit=" %"
            series={[
              { key: "actual", name: "Measured", color: "var(--primary)" },
              { key: "expected", name: "Expected for conditions", color: "var(--muted)" },
            ]}
          />
        </Card>
      )}
    </Page>
  );
}
