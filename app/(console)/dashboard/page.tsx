"use client";
import { useState } from "react";
import { MapPin, Siren, UserRound } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { Badge, Card, Kpi, KpiRow, LoadingPanel, Page, QualityBadge, SimTag, Skeleton } from "@/components/ui";
import { Mono } from "@/components/scada";
import { DataStatus, EventLog, LevelBadge, ProcessFlow, STAGES, ScrubberBadge, TagFaceplate, activeStages, useBoard, type StageId } from "@/components/plant";
import { ScramButton } from "@/components/safety";
import { FACILITY, PLANT } from "@/lib/demoData";
import { usePrefs } from "@/lib/store";
import { formatMoney, num } from "@/lib/format";
import { getHub } from "@/lib/telemetry/hub";

function SafetyRadial({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20" role="img" aria-label={`Plant safety score ${pct}%`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--ok)" strokeWidth="8" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 40 40)" strokeLinecap="round" />
    </svg>
  );
}

export default function Dashboard() {
  const { p, l, exhaust } = useBoard();
  const mode = usePrefs((s) => s.mode);
  const currency = usePrefs((s) => s.currency);
  const rate = usePrefs((s) => s.rate);
  const [stage, setStage] = useState<StageId | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const chart = p.history.slice(-60).map((h, i) => ({ i, v: mode === "LIVE" ? h.exhaust_mv : PLANT.flueGasPpm + ((h.exhaust_mv - 3600) / 60) * 6 }));
  const st = STAGES.find((s) => s.id === stage);

  return (
    <Page
      title="Executive plant dashboard"
      subtitle={
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden className="h-4 w-4" /> {FACILITY.name}, {FACILITY.location}
          </span>
          <span className="inline-flex items-center gap-1">
            <UserRound aria-hidden className="h-4 w-4" /> {FACILITY.shift}
          </span>
        </span>
      }
      actions={
        <>
          {mode === "DEMO" && (
            <button onClick={() => getHub().triggerLeak()} disabled={p.leakActive} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-warn/50 bg-warn-bg px-4 text-sm font-semibold text-warn-fg disabled:opacity-50">
              <Siren aria-hidden className="h-4 w-4" /> {p.leakActive ? "Leak sequence running" : "Trigger leak (Demo)"}
            </button>
          )}
          <ScramButton />
        </>
      }
    >
      <DataStatus />
      {!p.ready ? (
        <KpiRow>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </KpiRow>
      ) : (
        <KpiRow>
          <Kpi label="Plant Safety Score" value={`${p.plant.safetyScore}%`} sub="Aligned with ISO 45001 practice" tag={<SimTag kind="Demo" />} tone="ok">
            <div className="mt-3">
              <SafetyRadial pct={p.plant.safetyScore} />
            </div>
          </Kpi>
          <Kpi
            label="Active Flue Gas"
            value={mode === "LIVE" ? `${num(exhaust.mv)} mV` : `${num(p.plant.flueGasPpm)} PPM / ${num(p.plant.flueGasAdc)} ADC`}
            sub={mode === "LIVE" ? <>Exhaust MQ-2 (AT-102) · {num(exhaust.adc)} ADC</> : "Flue gas analyser"}
            tag={mode === "LIVE" ? <QualityBadge q={exhaust.q} /> : <SimTag kind="Demo" />}
          >
            <div className="mt-3 h-12" role="img" aria-label="Rolling flue gas trend">
              <ResponsiveContainer>
                <LineChart data={chart}>
                  <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                  <Line dataKey="v" stroke="var(--fluid)" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Kpi>
          <Kpi
            label="Ambient Leak Status"
            value={<LevelBadge level={l?.ambient_level} />}
            sub={l ? <>AT-101 {num(l.ambient_mv)} mV {l.trip_latched && <strong className="text-crit-fg">· trip latched</strong>}</> : "Waiting for data"}
            tone={l?.ambient_level === "CRITICAL" ? "crit" : l?.ambient_level === "WARNING" ? "warn" : "ok"}
            tag={mode === "LIVE" ? <Badge tone="ok">Board</Badge> : <SimTag kind="Demo" />}
          />
          <Kpi label="Daily CO2 Captured" value={`${p.plant.dailyCo2t} tCO2e`} sub={<>Spot value {formatMoney(PLANT.dailySpotKobo, currency, rate)}</>} tag={<SimTag />} />
        </KpiRow>
      )}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <Card title="Plant compartment twin" actions={<><ScrubberBadge s={l?.scrubber} /><SimTag /></>}>
          {!p.ready ? (
            <LoadingPanel />
          ) : (
            <>
              <p className="mb-4 text-sm text-muted">Stages animate from the firmware scrubber state ({l?.scrubber ?? "no data"}). Select a stage for its tags.</p>
              <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                  <ProcessFlow active={activeStages(l?.scrubber)} onStage={setStage} selected={stage} />
                </div>
              </div>
              {st && (
                <div className="mt-4 rounded-md border border-line bg-elev p-4">
                  <div className="font-semibold">{st.name}</div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-muted">Flow</dt>
                      <dd className="font-mono">
                        {num(st.flow, st.flow < 1 ? 2 : 0)} {st.id === "storage" ? "t/h" : "m³/h"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Pressure</dt>
                      <dd className="font-mono">{num(st.pKpa, 1)} kPa</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Temperature</dt>
                      <dd className="font-mono">{num(st.tC, 1)} °C</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {st.tags.map((t) => (
                      <button key={t} onClick={() => setTag(t)} className="rounded border border-line px-2 py-1 font-mono text-xs hover:bg-panel">
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
        <Card title="Recent event log" actions={<Mono className="text-xs text-muted">board events + app events</Mono>}>
          {!p.ready ? <LoadingPanel rows={6} /> : <EventLog events={p.events} limit={10} />}
        </Card>
      </div>
      <TagFaceplate id={tag} onClose={() => setTag(null)} />
    </Page>
  );
}
