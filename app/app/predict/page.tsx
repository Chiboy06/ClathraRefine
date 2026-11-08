"use client";
import { useMemo } from "react";
import { BrainCircuit, Siren } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Badge, Button, Card, Empty, Kpi, KpiRow, LoadingPanel, Notice, Page, QualityBadge, SimTag, Table, Td, useFetch, cx } from "@/components/ui";
import { Mono } from "@/components/scada";
import { DataStatus, useBoard } from "@/components/plant";
import { getHub } from "@/lib/telemetry/hub";
import { usePrefs } from "@/lib/store";
import { FW } from "@/lib/process";
import { formatTime, num } from "@/lib/format";
import { forecastAndScore, forecastCrossing, riskBand, riskIndex, risePerSecond, sessionAnomalyZ, type Model } from "@/lib/predict";

const SESSION_THRESHOLD = 6; // robust z-score; the trained model supplies its own

export default function Predict() {
  const { p, l, ambient } = useBoard();
  const mode = usePrefs((s) => s.mode);
  const model = useFetch<Model>("/api/model");
  const hasModel = !!model.data;

  const samples = useMemo(() => p.history.map((h) => ({ t: h.receivedAt, v: h.ambient_mv })), [p.history]);
  const values = useMemo(() => samples.map((s) => s.v), [samples]);
  const rise = risePerSecond(samples, 10);

  // Forecast: DEMO uses the scenario look-ahead (Simulated); LIVE uses the trained model, or nothing.
  const forecast = useMemo(() => {
    if (!p.ready || !l) return [] as { t: number; v: number }[];
    if (mode === "DEMO") return getHub().demoForecast(30);
    if (!model.data) return [];
    const r = forecastAndScore(model.data, values.slice(-16), l.exhaust_mv);
    if (!r) return [];
    const h = model.data.forecast.horizon_s;
    return Array.from({ length: h / 2 + 1 }, (_, i) => ({ t: p.now + i * 2000, v: Math.round(l.ambient_mv + ((r.forecast_mv - l.ambient_mv) * i) / (h / 2)) }));
    // p.now ticks every second, which refreshes the look-ahead
  }, [p.ready, p.now, l, mode, model.data, values]);

  const modelScore = mode === "LIVE" && model.data && l ? forecastAndScore(model.data, values.slice(-16), l.exhaust_mv) : null;
  const anomalyZ = modelScore ? modelScore.z : sessionAnomalyZ(values);
  const threshold = model.data?.anomaly.threshold ?? SESSION_THRESHOLD;
  const peakForecast = forecast.length ? Math.max(...forecast.map((f) => f.v)) : null;
  const risk = l ? riskIndex({ mv: l.ambient_mv, risePerS: rise, anomalyZ, forecastMv: peakForecast }) : 0;
  const warnIn = forecastCrossing(forecast, FW.AMB_WARN_ON_MV, p.now, l?.ambient_mv);
  const critIn = forecastCrossing(forecast, FW.AMB_CRIT_ON_MV, p.now, l?.ambient_mv);

  // Risk trend: the same index, recorded each second by the hub.
  const trend = p.riskHistory;

  // Anomalies: rising edges above the threshold against the session baseline.
  const anomalies = useMemo(() => {
    const clean = values.filter((v) => v < FW.AMB_WARN_OFF_MV && v >= FW.CHECK_SENSOR_MV).sort((a, b) => a - b);
    if (clean.length < 10) return [];
    const med = clean[Math.floor(clean.length / 2)];
    const mad = Math.max(clean.map((v) => Math.abs(v - med)).sort((a, b) => a - b)[Math.floor(clean.length / 2)] * 1.4826, 5);
    const out: { at: number; peak: number; z: number }[] = [];
    let open: { at: number; peak: number; z: number } | null = null;
    for (const s of samples) {
      const z = (s.v - med) / mad;
      if (z > threshold) {
        if (!open) open = { at: s.t, peak: s.v, z };
        else if (s.v > open.peak) {
          open.peak = s.v;
          open.z = z;
        }
      } else if (open) {
        out.push(open);
        open = null;
      }
    }
    if (open) out.push(open);
    return out.reverse().slice(0, 10);
  }, [values, samples, threshold]);

  let sinceBaseline: number | null = null;
  for (let i = p.history.length - 1; i > 0 && sinceBaseline === null; i--) {
    if (p.history[i].ambient_level === "NORMAL" && p.history[i - 1].ambient_level !== "NORMAL") sinceBaseline = Math.round((p.now - p.history[i].receivedAt) / 1000);
  }

  const chart = useMemo(() => {
    const past = samples.filter((s) => s.t >= p.now - 120_000).map((s) => ({ t: s.t, reading: s.v }));
    const last = past[past.length - 1];
    const ahead = forecast.map((f, i) => ({ t: f.t, forecast: i === 0 && last ? last.reading : f.v }));
    return [...past, ...ahead].sort((a, b) => a.t - b.t);
  }, [samples, forecast, p.now]);

  const bandTone = risk >= 70 ? "crit" : risk >= 35 ? "warn" : "ok";
  const noForecast = mode === "LIVE" && !model.loading && !hasModel;

  return (
    <Page
      title="Hazard prediction"
      subtitle="Know a leak is coming before the alarm. Predictions are advisory: the edge controller takes every safety action."
      actions={
        mode === "DEMO" && (
          <Button variant="primary" onClick={() => getHub().triggerLeak()} disabled={p.leakActive}>
            <Siren aria-hidden className="h-4 w-4" /> {p.leakActive ? "Leak building" : "Simulate a leak build-up"}
          </Button>
        )
      }
    >
      <DataStatus />
      {!p.ready ? (
        <LoadingPanel rows={6} />
      ) : (
        <>
          <section aria-labelledby="risk-h" className={cx("rounded-2xl border p-6 md:p-8", bandTone === "crit" ? "border-crit/60 bg-crit-bg" : bandTone === "warn" ? "border-warn/50 bg-warn-bg" : "border-line bg-panel")}>
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[auto_1fr]">
              <div>
                <h2 id="risk-h" className="text-sm font-semibold text-muted">
                  Hazard risk index
                </h2>
                <div className="mt-2 flex items-baseline gap-3" data-testid="risk-index">
                  <span className="font-mono text-7xl font-semibold tabular tracking-[-0.03em]">{risk}</span>
                  <span className="text-xl text-muted">/ 100</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={bandTone} size="lg">
                    {riskBand(risk)} risk
                  </Badge>
                  {mode === "DEMO" && <SimTag kind="Demo" />}
                </div>
                <p className="mt-4 max-w-sm text-sm text-muted">
                  {critIn !== null && critIn > 0
                    ? `Forecast reaches the trip threshold in about ${critIn} s.`
                    : warnIn !== null && warnIn > 0
                      ? `Forecast reaches the warning threshold in about ${warnIn} s.`
                      : l && l.ambient_level !== "NORMAL"
                        ? "The reading is already above a threshold. The edge controller is acting."
                        : "No threshold crossing in the next 30 s."}
                </p>
              </div>
              <div className="h-40" role="img" aria-label={`Risk trend over the last two minutes, now ${risk}`}>
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} hide />
                    <YAxis domain={[0, 100]} width={32} stroke="var(--muted)" fontSize={11} />
                    <ReferenceLine y={35} stroke="var(--warn)" strokeDasharray="3 3" />
                    <ReferenceLine y={70} stroke="var(--crit)" strokeDasharray="3 3" />
                    <Line dataKey="risk" stroke="var(--fg)" dot={false} strokeWidth={2} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <Card title="Forecast" actions={mode === "DEMO" ? <SimTag /> : hasModel ? <Badge tone="primary">Model {model.data!.version.slice(0, 10)}</Badge> : undefined}>
            {noForecast ? (
              <Empty title="No trained model yet">
                The forecast line appears once a model is trained on your own sensor data. Collect clean-air and exposure sessions, run <Mono>python train_models.py</Mono>, then copy <Mono>model.json</Mono> to <Mono>lib/model.json</Mono> and redeploy.
              </Empty>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-2" aria-live="polite">
                  <Badge tone={warnIn === null ? "neutral" : "warn"}>{warnIn === null ? "Warning: no crossing in 30 s" : warnIn === 0 ? "Warning threshold reached" : `Predicted crossing in ${warnIn} s: warning`}</Badge>
                  <Badge tone={critIn === null ? "neutral" : "crit"}>{critIn === null ? "Trip: no crossing in 30 s" : critIn === 0 ? "Trip threshold reached" : `Predicted crossing in ${critIn} s: trip`}</Badge>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <LineChart data={chart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                      <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => formatTime(v).slice(0, 8)} stroke="var(--muted)" fontSize={11} />
                      <YAxis stroke="var(--muted)" fontSize={11} unit=" mV" width={72} domain={[0, 3400]} />
                      <Tooltip labelFormatter={(v) => formatTime(Number(v))} contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--fg)", fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <ReferenceLine y={FW.AMB_WARN_ON_MV} stroke="var(--warn)" strokeDasharray="4 4" label={{ value: "Warning 1,410 mV", fill: "var(--warn-fg)", fontSize: 10, position: "insideTopLeft" }} />
                      <ReferenceLine y={FW.AMB_CRIT_ON_MV} stroke="var(--crit)" strokeDasharray="4 4" label={{ value: "Trip 2,710 mV", fill: "var(--crit-fg)", fontSize: 10, position: "insideTopLeft" }} />
                      <ReferenceLine x={p.now} stroke="var(--muted)" label={{ value: "Now", fill: "var(--muted)", fontSize: 10, position: "insideTop" }} />
                      {warnIn ? <ReferenceLine x={p.now + warnIn * 1000} stroke="var(--warn)" label={{ value: `Predicted crossing in ${warnIn} s`, fill: "var(--warn-fg)", fontSize: 10, position: "insideBottomRight" }} /> : null}
                      {critIn ? <ReferenceLine x={p.now + critIn * 1000} stroke="var(--crit)" label={{ value: `Predicted crossing in ${critIn} s`, fill: "var(--crit-fg)", fontSize: 10, position: "insideTopLeft" }} /> : null}
                      <Line dataKey="reading" name="Ambient reading (AT-101)" stroke="var(--fluid)" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
                      <Line dataKey="forecast" name="30 s forecast" stroke="var(--primary)" strokeDasharray="6 4" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {mode === "DEMO" && <p className="mt-2 text-xs text-muted">DEMO: the forecast is the scenario engine&apos;s look-ahead, not a trained model.</p>}
              </>
            )}
          </Card>

          <KpiRow>
            <Kpi label="Rate of rise" value={`${num(rise, 1)} mV/s`} sub="Last 10 seconds" />
            <Kpi label="Distance to warning" value={`${num(FW.AMB_WARN_ON_MV - ambient.mv)} mV`} sub={`Reading ${num(ambient.mv)} mV, warning at 1,410 mV`} />
            <Kpi label="Since last return to baseline" value={sinceBaseline === null ? "No excursion" : `${sinceBaseline} s`} sub="Time since the level last went back to Normal" />
            <Kpi label="Sensor quality" value={<QualityBadge q={ambient.q} />} sub="AT-101 ambient MQ-2" />
          </KpiRow>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <Card title="Anomaly score" actions={hasModel && mode === "LIVE" ? <Badge tone="primary">Trained model</Badge> : <SimTag kind="Simulated" />}>
              <div className="flex items-baseline gap-3">
                <Mono className="text-4xl font-semibold">{anomalyZ === null ? "–" : num(anomalyZ, 1)}</Mono>
                <span className="text-sm text-muted">threshold {num(threshold, 1)}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{anomalyZ === null ? "Collecting a clean-air baseline for this session." : hasModel && mode === "LIVE" ? "Robust z-score of level and 10 s rise from the trained detector." : "Robust z-score against this session's clean-air readings."}</p>
              <div className="mt-6">
                {anomalies.length ? (
                  <Table head={["Time", "Peak", "Score"]} caption="Last 10 anomalies">
                    {anomalies.map((a) => (
                      <tr key={a.at}>
                        <Td mono>{formatTime(a.at)}</Td>
                        <Td mono>{num(a.peak)} mV</Td>
                        <Td mono>{num(a.z, 1)}</Td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <Empty title="No anomalies this session">Unusual readings appear here with their time and peak.{mode === "DEMO" && " Simulate a leak build-up to see one."}</Empty>
                )}
              </div>
            </Card>

            <Card title="Model card" actions={<BrainCircuit aria-hidden className="h-4 w-4 text-muted" />}>
              {model.loading ? (
                <LoadingPanel />
              ) : hasModel ? (
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-muted">Version / trained</dt>
                  <dd className="font-mono">{model.data!.version}</dd>
                  <dt className="text-muted">30 s forecast error</dt>
                  <dd className="font-mono">
                    {num(model.data!.forecast.mae_mv)} mV vs {num(model.data!.forecast.persistence_mae_mv)} mV no-change baseline
                  </dd>
                  <dt className="text-muted">Exposures caught</dt>
                  <dd className="font-mono">{model.data!.report?.exposures_caught !== undefined ? `${model.data!.report.exposures_caught} of ${model.data!.report.exposures_total}` : "Not in report"}</dd>
                  <dt className="text-muted">Median warning lead</dt>
                  <dd className="font-mono">{model.data!.report?.median_lead_s !== undefined ? `${model.data!.report.median_lead_s} s` : "Not in report"}</dd>
                  <dt className="text-muted">False alarms per hour</dt>
                  <dd className="font-mono">{model.data!.report?.false_alarms_per_hour ?? "Not in report"}</dd>
                </dl>
              ) : (
                <div className="flex flex-col gap-3 text-sm">
                  <p>
                    <strong>No trained model yet.</strong> Version, training date, forecast error against the no-change baseline, exposures caught, median warning lead time and false alarms per hour appear here once <Mono>lib/model.json</Mono> exists.
                  </p>
                  <ol className="list-decimal pl-5 text-muted">
                    <li>Log 3 hours of clean air and 20 short exposures on the bench.</li>
                    <li>
                      Run <Mono>python train_models.py</Mono> on the S3 archive.
                    </li>
                    <li>
                      Copy <Mono>model.json</Mono> to <Mono>lib/model.json</Mono> and redeploy.
                    </li>
                  </ol>
                </div>
              )}
              <div className="mt-4" />
              <Notice tone="neutral">Predictions are advisory. They draw lines and raise notices; the edge controller takes every safety action, with or without the network.</Notice>
            </Card>
          </div>
        </>
      )}
    </Page>
  );
}
