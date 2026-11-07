"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, KpiRow, LoadingPanel, Page, QualityBadge, Segmented, SimTag, Table, Td, Badge } from "@/components/ui";
import { AnalogueBar, Mono, TrendChart } from "@/components/scada";
import { DataStatus, LevelBadge, ScrubberBadge, TagFaceplate, useBoard } from "@/components/plant";
import { usePrefs } from "@/lib/store";
import { formatConc, formatTime, num } from "@/lib/format";
import { M_CO2, R_GAS, simulateCapture, solventCapacityGPerL, adcToMv, FW } from "@/lib/process";
import { PLANT } from "@/lib/demoData";
import { tag } from "@/lib/tags";

const RANGES = { "15m": 15 * 60_000, "1h": 3_600_000, "24h": 86_400_000, "7d": 7 * 86_400_000 } as const;
type Range = keyof typeof RANGES;

/** DEMO backfill for ranges longer than the in-memory buffer. Simulated. */
function backfill(from: number, to: number, step: number) {
  const out: Record<string, number>[] = [];
  for (let t = from; t < to; t += step) {
    const amb = 483 + 12 * Math.sin(t / 7e5) + (Math.sin(t / 9.1e6) > 0.995 ? 1100 : 0);
    out.push({ t, ambient: Math.round(amb), exhaust: Math.round(3600 + 60 * Math.sin(t / 3.3e6)) });
  }
  return out;
}

function Measurements() {
  const { p, l, exhaust, ambient } = useBoard();
  const unit = usePrefs((s) => s.unit);
  const mode = usePrefs((s) => s.mode);
  const params = useSearchParams();
  const [range, setRange] = useState<Range>("15m");
  const [tagId, setTagId] = useState<string | null>(params.get("tag"));
  const pl = p.plant;

  const trend = useMemo(() => {
    const now = p.now;
    const from = now - RANGES[range];
    const live = p.history.filter((h) => h.receivedAt >= from).map((h) => ({ t: h.receivedAt, ambient: h.ambient_mv, exhaust: h.exhaust_mv }));
    if (mode === "DEMO" && range !== "15m") {
      const first = live[0]?.t ?? now;
      return [...backfill(from, first, Math.max(2000, RANGES[range] / 600)), ...live];
    }
    return live;
  }, [p.history, p.now, range, mode]);
  const markers = p.events.filter((e) => e.at >= (trend[0]?.t ?? Infinity) && (e.severity === "CRITICAL" || e.severity === "WARNING")).slice(0, 6).map((e) => ({ x: e.at, label: e.tag }));

  const T = pl.tempC + 273.15;
  const molH = (pl.pressurePa * pl.flowM3h) / (R_GAS * T);
  const run = useMemo(() => simulateCapture(120), []);

  return (
    <Page title="Live SCADA measurements and mass balance" subtitle="CO2 values are Simulated: the MQ-2 sensors detect combustible gases and smoke, not CO2.">
      <DataStatus />
      <Card title="CO2 capture rate (mass balance)" actions={<SimTag />}>
        <div className="flex flex-col gap-4">
          <div className="font-mono text-xl md:text-2xl">ṁ = (P × Q_gas / (R × T)) × (y_in − y_out) × M_CO2</div>
          <div className="overflow-x-auto font-mono text-sm text-muted md:text-base">
            ṁ = ({num(pl.pressurePa / 1000, 1)} kPa × {num(pl.flowM3h, 1)} m³/h / ({R_GAS.toFixed(3)} × {num(T, 2)} K)) × ({(pl.inletPct / 100).toFixed(4)} − {(pl.outletPct / 100).toFixed(4)}) × {M_CO2} kg/mol
          </div>
          <div className="font-mono text-sm text-muted">= {num(molH, 0)} mol/h × {((pl.inletPct - pl.outletPct) / 100).toFixed(4)} × {M_CO2}</div>
          <div className="text-3xl font-bold">
            <Mono>{num(pl.captureKgH, 1)} kg/hr</Mono> CO2 Captured
          </div>
          <p className="text-xs text-muted">Absorber pressure {num(pl.pressurePa / 1000, 1)} kPa(abs) is a scenario assumption chosen to match the plant design figure.</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <Card title="Inlet analyser (C_in), GPIO 1" actions={<SimTag />}>
          <div className="font-mono text-3xl font-bold">{formatConc(pl.inletPct, unit)}</div>
          <div className="mt-1 font-mono text-sm text-muted">{formatConc(pl.inletPct, unit === "PCT" ? "PPM" : "PCT")}</div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted">{mode === "LIVE" ? "Exhaust MQ-2 (board)" : "ADC counts"}</div>
              <Mono className="text-lg">{mode === "LIVE" ? num(exhaust.adc) : num(PLANT.inletAdc)} ADC</Mono>
            </div>
            <div>
              <div className="text-muted">Sensor millivolts</div>
              <Mono className="text-lg">{mode === "LIVE" ? num(exhaust.mv) : num(adcToMv(PLANT.inletAdc))} mV</Mono>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            Board quality: <QualityBadge q={exhaust.q} /> <ScrubberBadge s={l?.scrubber} />
          </div>
          <div className="mt-4">
            <AnalogueBar tag={tag("AT-103")} value={pl.inletPct} label="Inlet CO2 against range" />
          </div>
        </Card>
        <div className="flex justify-center">
          <div className="rounded-full border-2 border-ok bg-ok-bg px-6 py-4 text-center" data-testid="efficiency-pill">
            <div className="font-mono text-2xl font-bold text-ok-fg">{num(pl.efficiency, 2)}%</div>
            <div className="text-xs font-semibold">Removal Efficiency (η)</div>
            <div className="mt-1 font-mono text-[11px] text-muted">η = (C_in − C_out) / C_in</div>
          </div>
        </div>
        <Card title="Outlet analyser (C_out), post-demister" actions={<SimTag />}>
          <div className="font-mono text-3xl font-bold">{formatConc(pl.outletPct, unit)}</div>
          <div className="mt-1 font-mono text-sm text-muted">{formatConc(pl.outletPct, unit === "PCT" ? "PPM" : "PCT")}</div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted">ADC counts</div>
              <Mono className="text-lg">{num(PLANT.outletAdc)} ADC</Mono>
            </div>
            <div>
              <div className="text-muted">Sensor millivolts</div>
              <Mono className="text-lg">{num(adcToMv(PLANT.outletAdc))} mV</Mono>
            </div>
          </div>
          <div className="mt-4">
            <AnalogueBar tag={tag("AT-104")} value={pl.outletPct} label="Outlet CO2 against range" />
          </div>
        </Card>
      </div>

      <KpiRow>
        {[
          { id: "FT-301", label: "Gas Flow", v: `${num(pl.flowM3h, 0)} m³/h`, val: pl.flowM3h },
          { id: "PDT-302", label: "Column ΔP", v: `${num(pl.dpKpa, 2)} kPa`, val: pl.dpKpa, extra: <Badge tone="ok">Normal</Badge> },
          { id: "AIT-305", label: "Lean vs Rich pH", v: `${num(pl.leanPh, 1)} → ${num(pl.richPh, 1)}`, val: pl.richPh },
          { id: "TT-303", label: "Column Temp", v: `${num(pl.tempC, 1)} °C`, val: pl.tempC },
        ].map((k) => (
          <Card key={k.id}>
            <div className="flex items-start justify-between gap-2">
              <button onClick={() => setTagId(k.id)} className="text-left text-xs font-semibold uppercase tracking-wide text-muted hover:text-fg">
                {k.label} <Mono className="normal-case">({k.id})</Mono>
              </button>
              <SimTag />
            </div>
            <div className="mt-3 flex items-center gap-2 font-mono text-2xl font-bold">
              {k.v} {k.extra}
            </div>
            <div className="mt-3">
              <AnalogueBar tag={tag(k.id)} value={k.val} label={`${k.label} against range`} />
            </div>
          </Card>
        ))}
      </KpiRow>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card title="Solvent loading (0.025 M NaOH)" actions={<SimTag />}>
          <div className="text-sm text-muted">Capacity to carbonate: {solventCapacityGPerL().toFixed(2)} g CO2 per litre (CO2 + 2OH⁻ → CO3²⁻ + H2O).</div>
          <div className="mt-3 font-mono text-2xl font-bold">{num(pl.loadingPct, 1)}%</div>
          <div className="mt-2">
            <AnalogueBar tag={tag("LT-401")} value={pl.loadingPct} label="Solvent loading against range" />
          </div>
          <div className="mt-4 text-sm font-semibold">Bench simulator: 1% CO2 at 1 L/min through 2 L solvent</div>
          <TrendChart
            height={180}
            data={run.map((r) => ({ t: r.min * 60_000, outlet: r.outletPct * 100, loading: r.loadingPct }))}
            series={[
              { key: "loading", name: "Loading %", color: "var(--fluid)" },
              { key: "outlet", name: "Outlet CO2 (% of 1% × 100)", color: "var(--warn)" },
            ]}
          />
          <p className="text-xs text-muted">Starting capture efficiency 0.6 is an assumption, not a measurement. Time axis is minutes from start.</p>
        </Card>
        <Card title="Telemetry log (latest 5)" actions={<span className="text-xs text-muted">{mode === "LIVE" ? "Board via AWS" : "Scenario"}</span>}>
          {!p.ready ? (
            <LoadingPanel rows={5} />
          ) : (
            <Table head={["Time", "Exhaust", "Ambient", "Quality", "Status"]} caption="Latest telemetry">
              {p.history
                .slice(-5)
                .reverse()
                .map((h) => (
                  <tr key={h.receivedAt + h.uptime_ms}>
                    <Td mono>{formatTime(h.receivedAt)}</Td>
                    <Td mono>{num(h.exhaust_mv)} mV</Td>
                    <Td mono>{num(h.ambient_mv)} mV</Td>
                    <Td>
                      <QualityBadge q={h.sensor_fault || h.ambient_mv < FW.CHECK_SENSOR_MV ? "Bad" : h.warming_up || h.buffered ? "Uncertain" : (p.now - h.receivedAt > 10_000 ? "Stale" : "Good")} />
                    </Td>
                    <Td>
                      <LevelBadge level={h.ambient_level} />
                    </Td>
                  </tr>
                ))}
            </Table>
          )}
        </Card>
      </div>

      <Card title="Trend" actions={<Segmented label="Time range" value={range} onChange={setRange} options={(Object.keys(RANGES) as Range[]).map((r) => ({ value: r, label: r === "15m" ? "15 min" : r === "1h" ? "1 h" : r === "24h" ? "24 h" : "7 d" }))} />}>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {["AT-101", "AT-102"].map((t) => (
            <button key={t} onClick={() => setTagId(t)} className="rounded border border-line px-2 py-1 font-mono hover:bg-elev">
              {t} faceplate
            </button>
          ))}
          {mode === "DEMO" && range !== "15m" && <SimTag kind="Demo" />}
          {mode === "LIVE" && <span className="text-muted">LIVE shows readings received this session (up to 2 h).</span>}
        </div>
        <TrendChart
          data={trend}
          unit=" mV"
          series={[
            { key: "ambient", name: "AT-101 ambient", color: "var(--fluid)" },
            { key: "exhaust", name: "AT-102 exhaust", color: "var(--primary)" },
          ]}
          limits={[
            { y: FW.AMB_WARN_ON_MV, label: "AT-101 warn 1,410", color: "var(--warn)" },
            { y: FW.AMB_CRIT_ON_MV, label: "AT-101 trip 2,710", color: "var(--crit)" },
            { y: FW.EXH_ON_MV, label: "AT-102 start 1,770", color: "var(--primary)" },
          ]}
          markers={markers}
        />
        <div className="mt-2 text-xs text-muted">
          Ambient now <Mono>{num(ambient.mv)} mV</Mono> <QualityBadge q={ambient.q} />
        </div>
      </Card>
      <TagFaceplate id={tagId} onClose={() => setTagId(null)} />
    </Page>
  );
}

export default function MeasurementsPage() {
  return (
    <Suspense fallback={<LoadingPanel rows={6} />}>
      <Measurements />
    </Suspense>
  );
}
