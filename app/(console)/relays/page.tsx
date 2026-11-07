"use client";
import { useState } from "react";
import { Power, Timer, Users, Zap } from "lucide-react";
import { Badge, Button, Card, Empty, Notice, Page, Segmented, SimTag, cx, useMounted } from "@/components/ui";
import { Mono, useMe } from "@/components/scada";
import { DataStatus, RELAYS, SirenState, relayTone, useBoard } from "@/components/plant";
import { OverrideRequestModal, PendingApprovals, type OverrideSpec } from "@/components/safety";
import { relayOn } from "@/lib/fsm";
import { can } from "@/lib/roleMatrix";
import { usePrefs } from "@/lib/store";
import { formatTime } from "@/lib/format";
import { FW } from "@/lib/process";

/** Seconds since the scrubber entered its current state, from the sample history. */
function stateAge(history: { scrubber: string; receivedAt: number }[], now: number) {
  if (!history.length) return 0;
  const cur = history[history.length - 1].scrubber;
  let i = history.length - 1;
  while (i > 0 && history[i - 1].scrubber === cur) i--;
  return (now - history[i].receivedAt) / 1000;
}

export default function Relays() {
  const { p, l } = useBoard();
  const { me } = useMe();
  const mode = usePrefs((s) => s.mode);
  const mounted = useMounted();
  const [spec, setSpec] = useState<OverrideSpec | null>(null);
  const [refresh, setRefresh] = useState(0);
  const canRequest = can(me?.session?.role, "request_override");
  const age = stateAge(p.history, p.now);

  return (
    <Page
      title="Six-relay actuator control and safety deck"
      subtitle="The edge controller owns safety. Manual actions here are requests that need a second supervisor."
      actions={
        <>
          <Segmented
            label="Control mode"
            value={p.manualMode ? "MANUAL" : "AUTO"}
            onChange={(v) =>
              canRequest &&
              setSpec({
                kind: "manual_mode",
                target: "mode",
                value: v === "MANUAL" ? 1 : 0,
                title: v === "MANUAL" ? "Request MANUAL OVERRIDE mode" : "Return to AUTOMATIC - Edge FSM",
                consequence: v === "MANUAL" ? "Relay cards accept approved manual overrides. The firmware's safety interlocks still run on the board and win." : "Removes manual overrides; the edge FSM controls all relays.",
              })
            }
            options={[
              { value: "AUTO", label: "AUTOMATIC - Edge FSM" },
              { value: "MANUAL", label: "MANUAL OVERRIDE" },
            ]}
          />
          <Badge tone="primary" size="lg">
            <Users aria-hidden className="h-4 w-4" /> Two-Person Security
          </Badge>
        </>
      }
    >
      <DataStatus />
      {mode === "LIVE" && <Notice tone="neutral">LIVE mode: the firmware accepts only SCRAM and ping. Approved overrides and pulse tests are recorded and shown as &quot;Approved: requires firmware support&quot;.</Notice>}
      {!canRequest && mounted && <Notice tone="neutral">Your role can view the deck. Operators and supervisors can request pulse tests and overrides.</Notice>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {RELAYS.map((r) => {
          const on = relayOn(p.relayMask, r.n);
          const overridden = p.overrides[r.n];
          const tone = relayTone(r.n, on);
          return (
            <Card key={r.n} tone={on ? tone : undefined}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Relay {r.n} · GPIO {r.gpio} · <Mono>{r.tag}</Mono>
                  </div>
                  <h2 className="mt-1 text-lg font-bold">{r.name}</h2>
                </div>
                <r.icon aria-hidden className={cx("h-6 w-6", on ? "text-fg" : "text-muted")} />
              </div>
              <div className="mt-4" data-testid={`relay-${r.n}-state`}>
                <Badge tone={on ? tone : "neutral"} size="lg">
                  {on ? "ENERGISED (ON)" : "DE-ENERGISED (OFF)"}
                </Badge>
                {overridden && <SimTag kind="Simulated" />}
                {mode === "DEMO" && !overridden && <span className="ml-2"><SimTag kind="Demo" /></span>}
              </div>
              <dl className="mt-4 flex flex-col gap-1 text-sm">
                <dt className="sr-only">Load</dt>
                <dd>{r.load}</dd>
                <dt className="sr-only">Behaviour</dt>
                <dd className="text-muted">{r.detail}</dd>
              </dl>
              {r.n === 2 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <Timer aria-hidden className="h-4 w-4" />
                  {l?.scrubber === "INTAKE_ACTIVE" ? (
                    <span>
                      Sequential start in <Mono>{Math.max(0, FW.PUMP_STAGGER_MS / 1000 - age).toFixed(1)} s</Mono>
                    </span>
                  ) : l?.scrubber === "PURGING" ? (
                    <span>
                      Purge countdown <Mono>{Math.max(0, FW.PURGE_HOLD_MS / 1000 - age).toFixed(1)} s</Mono>
                    </span>
                  ) : (
                    <span>
                      2.0 s sequential delay · 5.0 s purge · now <Mono>{l?.scrubber ?? "no data"}</Mono>
                    </span>
                  )}
                </div>
              )}
              {r.n === 6 && <div className="mt-3">{p.ready && <SirenState snap={p} />}</div>}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button
                  disabled={!canRequest}
                  onClick={() => setSpec({ kind: "pulse_test", target: String(r.n), value: 1, title: `Pulse test: relay ${r.n}, ${r.name}`, consequence: `Relay ${r.n} (${r.name}) toggles for 1.5 s, then returns to edge FSM control.` })}
                >
                  <Zap aria-hidden className="h-4 w-4" /> Pulse test
                </Button>
                <Button
                  variant="slate"
                  disabled={!canRequest}
                  onClick={() => setSpec({ kind: "relay_override", target: String(r.n), value: on ? 0 : 1, title: `Override: relay ${r.n} ${on ? "OFF" : "ON"}`, consequence: `Forces relay ${r.n} (${r.name}) ${on ? "OFF" : "ON"} for 60 s against the edge FSM. ${r.n === 3 || r.n === 6 ? "This is a safety-indicating output." : ""}` })}
                >
                  <Power aria-hidden className="h-4 w-4" /> Request override
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="Pending approvals">
        <PendingApprovals refreshKey={refresh} />
      </Card>

      <Card title="Relay event strip (last 10 state changes each)">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {RELAYS.map((r, i) => (
            <div key={r.n} className="rounded-md border border-line p-4">
              <div className="mb-2 text-sm font-semibold">
                Relay {r.n} <Mono className="text-muted">{r.tag}</Mono>
              </div>
              {p.relayHistory[i].length ? (
                <ol className="flex flex-col gap-1 text-xs">
                  {p.relayHistory[i].map((c, j) => (
                    <li key={j} className="flex flex-wrap gap-2">
                      <Mono className="text-muted">{formatTime(c.at)}</Mono>
                      <Badge tone={c.on ? relayTone(r.n, true) : "neutral"}>{c.on ? "ON" : "OFF"}</Badge>
                      <span className="text-muted">{c.cause}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty title="No changes this session" />
              )}
            </div>
          ))}
        </div>
      </Card>
      <OverrideRequestModal spec={spec} onClose={() => setSpec(null)} onDone={() => setRefresh((x) => x + 1)} />
    </Page>
  );
}
