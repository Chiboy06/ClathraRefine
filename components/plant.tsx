"use client";
import { useMemo } from "react";
import { Bell, BellOff, CheckCircle2, Fan, Lightbulb, Siren, Waves, type LucideIcon } from "lucide-react";
import { AnalogueBar, Drawer, Mono } from "./scada";
import { Badge, cx, Empty, Notice, QualityBadge, SimTag, type Tone } from "./ui";
import { usePlant } from "@/lib/telemetry/usePlant";
import type { HubEvent, Snapshot } from "@/lib/telemetry/hub";
import { quality } from "@/lib/quality";
import { formatTime, formatDateTime, num } from "@/lib/format";
import { mvToAdc, FW, ADC_TIERS } from "@/lib/process";
import { TAGS } from "@/lib/tags";
import { relayOn } from "@/lib/fsm";
import { usePrefs } from "@/lib/store";

/** Board readings with quality and trend, ready for display. */
export function useBoard() {
  const p = usePlant();
  const l = p.latest;
  const prev = p.history[p.history.length - 2];
  const now = p.now;
  const q = (mv?: number) => (l ? quality({ mv, sensorFault: l.sensor_fault, warmingUp: l.warming_up, buffered: l.buffered, updatedAt: l.receivedAt }, now) : "Stale");
  return {
    p,
    l,
    exhaust: { mv: l?.exhaust_mv ?? 0, adc: mvToAdc(l?.exhaust_mv ?? 0), q: q(l?.exhaust_mv), trend: l && prev ? l.exhaust_mv - prev.exhaust_mv : undefined },
    ambient: { mv: l?.ambient_mv ?? 0, adc: mvToAdc(l?.ambient_mv ?? 0), q: q(l?.ambient_mv), trend: l && prev ? l.ambient_mv - prev.ambient_mv : undefined },
    stale: !l || now - l.receivedAt > 10_000,
  };
}

/** Shown when LIVE data is missing or old. */
export function DataStatus() {
  const { p, stale } = useBoard();
  const mode = usePrefs((s) => s.mode);
  if (!p.ready) return null;
  if (p.status.error) return <Notice tone="crit">LIVE data unavailable: {p.status.error}. Plant-scale values continue on the DEMO scenario and are tagged Simulated.</Notice>;
  if (stale && p.latest) return <Notice tone="warn">No reading for over 10 s. Values are marked Stale. Check the board and Wi-Fi.</Notice>;
  if (stale && mode === "LIVE") return <Notice tone="neutral">Waiting for the first LIVE reading…</Notice>;
  if (p.latest?.check_sensor) return <Notice tone="crit">Check sensor: a reading is below 100 mV. That is not clean air.</Notice>;
  return null;
}

export const SEV_TONE: Record<HubEvent["severity"], Tone> = { INFO: "fluid", WARNING: "warn", CRITICAL: "crit", PASS: "ok", AUDIT: "primary" };

export function EventLog({ events, limit = 12 }: { events: HubEvent[]; limit?: number }) {
  if (!events.length) return <Empty title="No events yet" />;
  return (
    <ol className="flex flex-col divide-y divide-line" aria-label="Recent events">
      {events.slice(0, limit).map((e) => (
        <li key={e.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-3">
          <Mono className="w-28 shrink-0 text-xs text-muted">{formatTime(e.at)}</Mono>
          <Badge tone={SEV_TONE[e.severity]}>{e.severity}</Badge>
          <Mono className="text-xs text-muted">{e.tag}</Mono>
          <span className="text-sm">{e.message}</span>
          {e.source === "demo" && <SimTag kind="Demo" />}
        </li>
      ))}
    </ol>
  );
}

export { STAGES, activeStages, ProcessFlow, type StageId } from "./flow";

/** Tag faceplate: value, quality, range, limits, recent alarms and definition. */
export function TagFaceplate({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { p, l, ambient, exhaust } = useBoard();
  const t = id ? TAGS.find((x) => x.id === id) : null;
  const value = useMemo(() => {
    if (!t) return null;
    const pl = p.plant;
    const map: Record<string, number> = {
      "AT-101": ambient.mv,
      "AT-102": exhaust.mv,
      "AT-103": pl.inletPct,
      "AT-104": pl.outletPct,
      "FT-301": pl.flowM3h,
      "PDT-302": pl.dpKpa,
      "TT-303": pl.tempC,
      "AIT-304": pl.leanPh,
      "AIT-305": pl.richPh,
      "LT-401": pl.loadingPct,
      "FQ-501": pl.captureKgH,
      "XV-201": +relayOn(p.relayMask, 1),
      "P-202": +relayOn(p.relayMask, 2),
      "XL-203": +relayOn(p.relayMask, 3),
      "XL-204": +relayOn(p.relayMask, 4),
      "XL-205": +relayOn(p.relayMask, 5),
      "XA-206": +relayOn(p.relayMask, 6),
      "HS-001": +!!l?.scram,
    };
    return map[t.id] ?? 0;
  }, [t, p, l, ambient.mv, exhaust.mv]);
  const q = t?.source === "board" ? (t.id === "AT-102" ? exhaust.q : ambient.q) : null;
  return (
    <Drawer open={!!t} onClose={onClose} title={t ? `${t.id} faceplate` : ""}>
      {t && value !== null && (
        <div className="flex flex-col gap-5">
          <div>
            <div className="text-sm text-muted">{t.name}</div>
            <div className="mt-2 flex items-center gap-3">
              <Mono className="text-3xl font-bold">
                {t.unit === "state" ? (value ? "ON" : "OFF") : num(value, t.unit === "mV" ? 0 : 2)}
              </Mono>
              {t.unit !== "state" && <span className="text-muted">{t.unit}</span>}
              {q ? <QualityBadge q={q} /> : <SimTag />}
            </div>
          </div>
          {t.unit !== "state" && <AnalogueBar tag={t} value={value} label={`${t.id} against range`} />}
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted">Range</dt>
            <dd className="font-mono">
              {t.min} to {t.max} {t.unit}
            </dd>
            <dt className="text-muted">Normal band</dt>
            <dd className="font-mono">
              {t.normal[0]} to {t.normal[1]}
            </dd>
            {t.lo !== undefined && (
              <>
                <dt className="text-muted">Low limit</dt>
                <dd className="font-mono">{t.lo}</dd>
              </>
            )}
            {t.hi !== undefined && (
              <>
                <dt className="text-muted">High limit</dt>
                <dd className="font-mono">{t.hi}</dd>
              </>
            )}
            {t.hihi !== undefined && (
              <>
                <dt className="text-muted">High-high / trip</dt>
                <dd className="font-mono">{t.hihi}</dd>
              </>
            )}
            <dt className="text-muted">Source</dt>
            <dd>{t.source === "board" ? "ESP32-S3 board (LIVE) or scenario (DEMO)" : "DEMO scenario (Simulated)"}</dd>
          </dl>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Recent alarms</h3>
            {p.incidents.filter((i) => i.tag === t.id).length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {p.incidents
                  .filter((i) => i.tag === t.id)
                  .slice(0, 5)
                  .map((i) => (
                    <li key={i.id} className="flex gap-2">
                      <Mono className="text-muted">{formatDateTime(i.at)}</Mono> peak <Mono>{i.peak}</Mono>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No alarms on this tag in this session.</p>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Definition</h3>
            <p className="text-sm text-muted">{t.definition}</p>
          </div>
        </div>
      )}
    </Drawer>
  );
}

export const RELAYS: { n: number; gpio: number; tag: string; name: string; load: string; icon: LucideIcon; color: Tone; detail: string }[] = [
  { n: 1, gpio: 6, tag: "XV-201", name: "Air intake fan", load: "Extraction fan, 230 V AC via relay", icon: Fan, color: "fluid", detail: "On at scrubber start and during SCRAM." },
  { n: 2, gpio: 7, tag: "P-202", name: "CO2 liquid pump", load: "Solvent circulation pump, 12 V DC", icon: Waves, color: "fluid", detail: "2.0 s sequential delay after the fan; 5.0 s purge after gas clears." },
  { n: 3, gpio: 8, tag: "XL-203", name: "Red hazard light", load: "Red strobe, 12 V DC", icon: Lightbulb, color: "crit", detail: `Trips at ADC ≥ ${ADC_TIERS.crit} (firmware ${FW.AMB_CRIT_ON_MV} mV on, ${FW.AMB_CRIT_OFF_MV} mV off).` },
  { n: 4, gpio: 9, tag: "XL-204", name: "Green normal light", load: "Green lamp, 12 V DC", icon: CheckCircle2, color: "ok", detail: "On at NORMAL after warm-up." },
  { n: 5, gpio: 10, tag: "XL-205", name: "Yellow pre-hazard light", load: "Yellow lamp, 12 V DC", icon: Lightbulb, color: "warn", detail: `${ADC_TIERS.warn} ≤ ADC < ${ADC_TIERS.crit} (firmware ${FW.AMB_WARN_ON_MV} mV on, ${FW.AMB_WARN_OFF_MV} mV off). Also on during warm-up.` },
  { n: 6, gpio: 11, tag: "XA-206", name: "Siren horn", load: "Siren, 110 dB, 12 V DC", icon: Siren, color: "crit", detail: "On while a trip is latched; the first physical ACK press silences it." },
];

export function relayTone(n: number, on: boolean): Tone {
  if (!on) return "neutral";
  return RELAYS[n - 1].color;
}

export function SirenState({ snap }: { snap: Snapshot }) {
  const silenced = snap.latest?.siren_silenced;
  return silenced ? (
    <Badge tone="warn">
      <BellOff aria-hidden className="h-3.5 w-3.5" /> Muted (silenced at board)
    </Badge>
  ) : (
    <Badge tone="ok" icon={false}>
      <Bell aria-hidden className="h-3.5 w-3.5" /> Armed
    </Badge>
  );
}

/** Three-tier escalation strip with the live ambient position. */
export function EscalationStrip({ adc, mv }: { adc: number; mv: number }) {
  const pos = Math.min(100, (adc / ADC_TIERS.max) * 100);
  const tiers = [
    { name: "Normal", range: `0 to ${ADC_TIERS.warn - 1} ADC`, fw: `< ${FW.AMB_WARN_ON_MV} mV (clears ≤ ${FW.AMB_WARN_OFF_MV})`, w: ADC_TIERS.warn, cls: "bg-ok-bg border-ok/50 text-ok-fg" },
    { name: "Pre-Hazard", range: `${ADC_TIERS.warn} to ${ADC_TIERS.crit - 1} ADC`, fw: `${FW.AMB_WARN_ON_MV} to ${FW.AMB_CRIT_ON_MV - 1} mV`, w: ADC_TIERS.crit - ADC_TIERS.warn, cls: "bg-warn-bg border-warn/50 text-warn-fg" },
    { name: "Critical Hazard + siren", range: `${ADC_TIERS.crit} to ${ADC_TIERS.max} ADC`, fw: `≥ ${FW.AMB_CRIT_ON_MV} mV (clears ≤ ${FW.AMB_CRIT_OFF_MV})`, w: ADC_TIERS.max - ADC_TIERS.crit + 1, cls: "bg-crit-bg border-crit/60 text-crit-fg" },
  ];
  return (
    <div>
      <div className="relative flex overflow-hidden rounded-md border border-line">
        {tiers.map((t) => (
          <div key={t.name} className={cx("border-r p-4 last:border-r-0", t.cls)} style={{ flexGrow: t.w, flexBasis: 0 }}>
            <div className="text-sm font-bold">{t.name}</div>
            <div className="font-mono text-xs tabular">{t.range}</div>
            <div className="font-mono text-xs tabular">{t.fw}</div>
          </div>
        ))}
        <div className="absolute inset-y-0 w-1 bg-fg transition-[left] duration-200" style={{ left: `${pos}%` }} aria-hidden />
      </div>
      <div className="mt-2 text-sm">
        Live ambient (AT-101): <Mono className="font-semibold">{mvToAdcLabel(adc, mv)}</Mono>
      </div>
    </div>
  );
}
const mvToAdcLabel = (adc: number, mv: number) => `${num(adc)} ADC / ${num(mv)} mV`;

export function LevelBadge({ level }: { level?: string }) {
  if (!level) return <Badge tone="neutral">No data</Badge>;
  return <Badge tone={level === "CRITICAL" ? "crit" : level === "WARNING" ? "warn" : "ok"}>{level === "NORMAL" ? "Normal" : level === "WARNING" ? "Pre-hazard" : "Critical"}</Badge>;
}

export function ScrubberBadge({ s }: { s?: string }) {
  return <Badge tone={s === "SCRUBBING" ? "fluid" : s === "IDLE" || !s ? "neutral" : "warn"}>{s ?? "No data"}</Badge>;
}

