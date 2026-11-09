"use client";
import Image from "next/image";
import Link from "next/link";
import { Bot } from "lucide-react";
import { Badge, Card, LoadingPanel, Page, SimTag, Skeleton, cx, useFetch } from "@/components/ui";
import { DataStatus, EventLog, LevelBadge } from "@/components/plant";
import { MainTrend } from "@/components/trends";
import { useAssistant } from "@/components/assistant";
import { usePlant } from "@/lib/telemetry/usePlant";
import { getHub } from "@/lib/telemetry/hub";
import { plantView, type Reading } from "@/lib/plantView";
import { riskBand } from "@/lib/predict";
import { num, formatTime } from "@/lib/format";
import { SITE_DEFAULTS, type SiteDetails } from "@/lib/site";

function Big({ label, value, sub, tag, tone }: { label: string; value: string; sub?: string; tag?: boolean; tone?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-2 text-xs font-semibold text-muted">
        {label}
        {tag && <SimTag />}
      </div>
      <div className={cx("mt-2 font-mono text-2xl font-semibold tabular tracking-[-0.02em]", tone)}>{value}</div>
      {sub && <div className="mt-0.5 font-mono text-xs text-muted tabular">{sub}</div>}
    </div>
  );
}

const fmt = (r: Reading, dp = 0) => `${num(r.value, dp)} ${r.unit}`;

export default function Overview() {
  const p = usePlant();
  const site = useFetch<Record<string, unknown>>("/api/settings");
  const details: SiteDetails = { ...SITE_DEFAULTS, ...((site.data?.site as Partial<SiteDetails>) ?? {}) };
  const { msgs } = useAssistant();
  const latestBrief = [...msgs].reverse().find((m) => m.kind === "briefing");
  const latestAlert = [...msgs].reverse().find((m) => m.kind === "alert");
  const v = p.ready ? plantView(p, getHub().demoForecast(30)) : null;

  return (
    <Page title="Plant overview" subtitle="CO2 capture and gas safety at a glance.">
      <DataStatus />
      <section className="grid grid-cols-1 overflow-hidden rounded-2xl border border-line bg-panel lg:grid-cols-[1.1fr_1fr]" aria-label="Plant">
        <figure className="relative bg-[#0b1222]">
          <Image src="/images/plant-3d.png" alt="3D model of the capture skid: frame, packed column, solvent tank, pump, fan with duct and sensor housings" width={1200} height={760} className="h-full w-full object-cover" priority />
          <figcaption className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">Illustrative model</figcaption>
        </figure>
        <dl className="grid grid-cols-[auto_1fr] content-center gap-x-6 gap-y-3 p-6 text-sm">
          <dt className="text-muted">Plant</dt>
          <dd className="font-semibold">{details.plant}</dd>
          <dt className="text-muted">Location</dt>
          <dd>{details.location}</dd>
          <dt className="text-muted">Device</dt>
          <dd className="font-mono">{details.device}</dd>
          <dt className="text-muted">Firmware</dt>
          <dd className="font-mono">{p.latest?.fw ?? details.firmware}</dd>
          <dt className="text-muted">Sensors fitted</dt>
          <dd>{details.sensors}</dd>
          <dt className="text-muted">Solvent</dt>
          <dd>
            {details.solventL} L of {details.solventM} M NaOH
          </dd>
          <dt className="text-muted">Commissioned</dt>
          <dd>{details.commissioned}</dd>
          <dt className="text-muted">Data mode</dt>
          <dd>
            <Badge tone={p.mode === "LIVE" ? "ok" : "warn"}>{p.mode}</Badge>
          </dd>
        </dl>
      </section>

      {!v ? (
        <Skeleton className="h-48" />
      ) : (
        <section aria-label="Key readings" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-testid="key-readings">
          <Big label="Inlet CO2" value={fmt(v.co2InPpm)} sub={`${num(v.co2InPpm.value / 10_000, 2)}% Vol`} />
          <Big label="Outlet CO2" value={fmt(v.co2OutPpm)} sub={`${num(v.co2OutPpm.value / 10_000, 2)}% Vol`} />
          <Big label="CO2 reduction" value={`${num(v.reductionPct.value, 1)}%`} tone="text-ok-fg" />
          <Big label="CO2 captured today" value={`${num(v.capturedTodayG.value, 2)} g`} sub={`${num(v.capturedSinceSolventG.value, 2)} g since solvent change`} />
          <Big label="Gas flow" value={fmt(v.gasLpm, 2)} tag={v.gasLpm.simulated} />
          <Big label="Solvent flow" value={fmt(v.liquidLpm, 2)} tag={v.liquidLpm.simulated} />
          <Big label="Solvent temperature" value={fmt(v.solventC, 1)} tag={v.solventC.simulated} />
          <Big label="Solvent pH" value={num(v.ph.value, 2)} tag={v.ph.simulated} />
          <div className="min-w-0 rounded-2xl border border-line bg-panel p-4">
            <div className="text-xs font-semibold text-muted">Ambient gas safety</div>
            <div className="mt-2">
              <LevelBadge level={v.ambient.level} />
            </div>
            <div className="mt-1 font-mono text-xs text-muted tabular">{num(v.ambient.mv)} mV</div>
          </div>
          <Link href="/app/ai/predictions" className="min-w-0 rounded-2xl border border-line bg-panel p-4 hover:bg-elev">
            <div className="text-xs font-semibold text-muted">Hazard risk</div>
            <div className={cx("mt-2 font-mono text-2xl font-semibold tabular", v.risk >= 70 ? "text-crit-fg" : v.risk >= 35 ? "text-warn-fg" : "text-ok-fg")} data-testid="overview-risk">
              {v.risk}
              <span className="text-sm text-muted"> / 100</span>
            </div>
            <div className="mt-0.5 text-xs text-muted">{v.critIn ? `Trip forecast in ${v.critIn} s` : v.warnIn ? `Warning forecast in ${v.warnIn} s` : `${riskBand(v.risk)}: no crossing in 30 s`}</div>
          </Link>
        </section>
      )}

      <MainTrend />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="AI briefing" help="What changed in the last hour, what is predicted next and what to do. Refreshed on alarms and every 15 minutes. Advisory only." actions={<Bot aria-hidden className="h-4 w-4 text-muted" />}>
          {latestAlert && (
            <p className="mb-3 rounded-xl border border-warn/50 bg-warn-bg p-3 text-sm">
              {latestAlert.text} <span className="text-xs text-muted">{formatTime(latestAlert.at)}</span>
            </p>
          )}
          {latestBrief ? <p className="text-sm leading-relaxed">{latestBrief.text}</p> : <LoadingPanel rows={2} />}
          <button onClick={() => useAssistant.getState().setOpen(true)} className="mt-4 text-sm font-semibold text-primary-fg hover:underline">
            Ask the assistant
          </button>
        </Card>
        <Card title="Recent events">{!p.ready ? <LoadingPanel rows={5} /> : <EventLog events={p.events} limit={8} />}</Card>
      </div>
    </Page>
  );
}
