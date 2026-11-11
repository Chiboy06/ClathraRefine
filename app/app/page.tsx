"use client";
import Image from "next/image";
import Link from "next/link";
import { Bot } from "lucide-react";
import { Card, LoadingPanel, Page, SimTag, Skeleton, cx, useFetch } from "@/components/ui";
import { DataStatus, EventLog } from "@/components/plant";
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

const TONES = {
  ok: "border-ok/50 bg-ok-bg text-ok-fg",
  warn: "border-warn/50 bg-warn-bg text-warn-fg",
  crit: "border-crit/60 bg-crit-bg text-crit-fg",
  neutral: "border-line bg-panel text-fg",
} as const;

function Status({ href, label, value, detail, tone, simulated, testId }: { href: string; label: string; value: string; detail: string; tone: keyof typeof TONES; simulated?: boolean; testId?: string }) {
  return (
    <Link href={href} className={cx("min-w-0 rounded-2xl border p-5 transition-colors hover:brightness-[0.98]", TONES[tone])} data-testid={testId}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
        {label}
        {simulated && <SimTag />}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{value}</div>
      <p className="mt-1 text-sm opacity-90">{detail}</p>
    </Link>
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
      {!v ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          {/* The three questions an operator asks first, answered in one row and coloured by state. */}
          <section aria-label="Plant status" className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Status
              href="/app/alarms"
              label="Gas safety"
              tone={v.tripped || v.ambient.level === "CRITICAL" ? "crit" : v.ambient.level === "WARNING" || v.critIn ? "warn" : "ok"}
              value={v.tripped ? "Tripped" : v.ambient.level === "CRITICAL" ? "Critical" : v.ambient.level === "WARNING" ? "Pre-hazard" : "Safe"}
              detail={v.critIn ? `Trip forecast in ${v.critIn} s. Ventilate now.` : `Risk ${v.risk}/100, ${riskBand(v.risk).toLowerCase()}. No crossing forecast in 30 s.`}
              testId="overview-risk"
            />
            <Status
              href="/app/ai/capture"
              label="CO2 capture"
              tone={v.scrubber !== "SCRUBBING" ? "neutral" : v.reductionPct.value >= 50 ? "ok" : "warn"}
              value={v.scrubber === "SCRUBBING" ? `${num(v.reductionPct.value, 1)}% removed` : "Scrubber idle"}
              detail={`${num(v.capturedTodayG.value, 2)} g captured today.`}
              simulated={v.reductionPct.simulated}
            />
            <Status
              href="/app/settings/connect"
              label="Edge controller"
              tone={p.link.connected ? "ok" : "crit"}
              value={p.link.connected ? "Online" : "Offline"}
              detail={p.link.lastAt ? `Last reading ${formatTime(p.link.lastAt)}. ${p.mode === "DEMO" ? "Scenario data." : "Live data."}` : "No reading yet. Connect a device."}
            />
          </section>

          <section aria-label="Key readings" className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="key-readings">
            <Big label="Inlet CO2" value={fmt(v.co2InPpm)} sub={`${num(v.co2InPpm.value / 10_000, 2)}% Vol`} />
            <Big label="Outlet CO2" value={fmt(v.co2OutPpm)} sub={`${num(v.co2OutPpm.value / 10_000, 2)}% Vol`} />
            <Big label="Gas flow" value={fmt(v.gasLpm, 2)} tag={v.gasLpm.simulated} />
            <Big label="Solvent flow" value={fmt(v.liquidLpm, 2)} tag={v.liquidLpm.simulated} />
            <Big label="Solvent temperature" value={fmt(v.solventC, 1)} tag={v.solventC.simulated} />
            <Big label="Solvent pH" value={num(v.ph.value, 2)} tag={v.ph.simulated} />
          </section>
        </>
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

      <section className="grid grid-cols-1 overflow-hidden rounded-2xl border border-line bg-panel md:grid-cols-[18rem_1fr]" aria-label="About this plant">
        <figure className="relative bg-[#0b1222]">
          <Image src="/images/plant-3d.png" alt="3D model of the capture skid: frame, packed column, solvent tank, pump, fan with duct and sensor housings" width={1200} height={760} className="h-full w-full object-cover" />
          <figcaption className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] text-white">Illustrative model</figcaption>
        </figure>
        <dl className="grid grid-cols-[auto_1fr] content-center gap-x-6 gap-y-2 p-5 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
          <dt className="text-muted">Plant</dt>
          <dd className="font-semibold">{details.plant}</dd>
          <dt className="text-muted">Location</dt>
          <dd>{details.location}</dd>
          <dt className="text-muted">Device</dt>
          <dd className="break-all font-mono">{details.device}</dd>
          <dt className="text-muted">Firmware</dt>
          <dd className="font-mono">{p.latest?.fw ?? details.firmware}</dd>
          <dt className="text-muted">Solvent</dt>
          <dd>
            {details.solventL} L of {details.solventM} M NaOH
          </dd>
          <dt className="text-muted">Commissioned</dt>
          <dd>{details.commissioned}</dd>
        </dl>
      </section>
    </Page>
  );
}
