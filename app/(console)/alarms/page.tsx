"use client";
import { useMemo, useState } from "react";
import { Archive, Check, Hand, Siren } from "lucide-react";
import { Badge, Button, Card, Empty, ErrorNote, Field, inputCls, Kpi, KpiRow, Notice, Page, SimTag, Table, Td, postJson, type Tone } from "@/components/ui";
import { Modal, Mono, useMe } from "@/components/scada";
import { DataStatus, EscalationStrip, LevelBadge, useBoard } from "@/components/plant";
import { getHub } from "@/lib/telemetry/hub";
import { can } from "@/lib/roleMatrix";
import { usePrefs } from "@/lib/store";
import { PRIORITY_RANK, isChattering, type Alarm, type AlarmState, type Priority } from "@/lib/alarms";
import { formatDateTime, formatTime } from "@/lib/format";

const PRI_TONE: Record<Priority, Tone> = { critical: "crit", high: "warn", medium: "primary", low: "neutral" };
const STATE_LABEL: Record<AlarmState, { label: string; tone: Tone }> = {
  UNACK_ACTIVE: { label: "Unacknowledged active", tone: "crit" },
  ACK_ACTIVE: { label: "Acknowledged active", tone: "warn" },
  RTN_UNACK: { label: "Returned unacknowledged", tone: "primary" },
  SHELVED: { label: "Shelved", tone: "neutral" },
  SUPPRESSED: { label: "Suppressed (warm-up)", tone: "neutral" },
  NORMAL: { label: "Normal", tone: "ok" },
};

function ShelveModal({ alarm, onClose }: { alarm: Alarm | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [mins, setMins] = useState(30);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!alarm) return;
    setBusy(true);
    setErr("");
    try {
      const until = Date.now() + mins * 60_000;
      await postJson("/api/alarms", { action: "shelve", alarm_id: alarm.id, reason, until });
      getHub().shelve(alarm.id, reason, until);
      setReason("");
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={!!alarm} onClose={onClose} title={`Shelve ${alarm?.id ?? ""}`}>
      <div className="flex flex-col gap-4">
        <Notice tone="warn">Shelving hides the alarm from the banner until the expiry. It does not change the board: the firmware still trips on its own thresholds.</Notice>
        <Field id="sh-reason" label="Reason (required)">
          <input id="sh-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
        </Field>
        <Field id="sh-exp" label="Expiry">
          <select id="sh-exp" value={mins} onChange={(e) => setMins(Number(e.target.value))} className={inputCls}>
            {[15, 30, 60, 240, 480].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutes` : `${m / 60} hours`}
              </option>
            ))}
          </select>
        </Field>
        {err && <ErrorNote>{err}</ErrorNote>}
        <Button variant="primary" disabled={!reason.trim()} busy={busy} onClick={submit}>
          <Archive aria-hidden className="h-4 w-4" /> Shelve for {mins < 60 ? `${mins} minutes` : `${mins / 60} hours`}
        </Button>
      </div>
    </Modal>
  );
}

export default function Alarms() {
  const { p, l, ambient } = useBoard();
  const { me } = useMe();
  const mode = usePrefs((s) => s.mode);
  const [shelve, setShelve] = useState<Alarm | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState({ q: "", pri: "all" });
  const canAck = can(me?.session?.role, "ack");

  const active = p.alarms.filter((a) => a.state !== "NORMAL").sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.since - a.since);
  const ack = async (a: Alarm) => {
    setErr("");
    try {
      await postJson("/api/alarms", { action: "ack", alarm_id: a.id });
      getHub().ack(a.id, me?.session?.name ?? "operator");
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const now = p.now;
  const allActs = Object.values(p.activations).flat();
  const per10 = allActs.filter((t) => now - t <= 600_000).length;
  const standing = p.alarms.filter((a) => a.active && now - a.since > 600_000).length;
  const chattering = Object.values(p.activations).filter((ts) => isChattering(ts, now)).length;
  const top10 = useMemo(() => {
    const counts = new Map<string, number>();
    p.incidents.forEach((i) => counts.set(i.tag, (counts.get(i.tag) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [p.incidents]);
  const incidents = p.incidents.filter((i) => (filter.pri === "all" || i.priority === filter.pri) && (!filter.q || `${i.id} ${i.tag} ${i.location} ${i.action}`.toLowerCase().includes(filter.q.toLowerCase())));

  return (
    <Page
      title="Hazard alarms and escalation management"
      subtitle="Software acknowledgement on screen is separate from the physical ACK button on GPIO 4, which is the only way to reset a latched trip."
      actions={
        mode === "DEMO" && (
          <>
            <Button onClick={() => getHub().triggerLeak()} disabled={p.leakActive} data-testid="trigger-leak">
              <Siren aria-hidden className="h-4 w-4" /> {p.leakActive ? "Leak sequence running" : "Trigger leak"}
            </Button>
            <Button onClick={() => getHub().pressAckDemo()}>
              <Hand aria-hidden className="h-4 w-4" /> Press physical ACK (simulated)
            </Button>
          </>
        )
      }
    >
      <DataStatus />
      <Card title="Escalation strip (ambient AT-101)" actions={<span data-testid="ambient-level"><LevelBadge level={l?.ambient_level} /></span>}>
        <EscalationStrip adc={ambient.adc} mv={ambient.mv} />
        <div className="mt-3 flex flex-wrap gap-3 text-sm" data-testid="board-flags">
          <Badge tone={l?.trip_latched ? "crit" : "ok"}>{l?.trip_latched ? "Trip latched" : "Trip clear"}</Badge>
          <Badge tone={l?.scram ? "crit" : "ok"}>{l?.scram ? "SCRAM latched" : "No SCRAM"}</Badge>
          {l?.warming_up && <Badge tone="warn">Warming up: alarms suppressed</Badge>}
        </div>
      </Card>

      <Card title="Active alarms">
        {err && <ErrorNote>{err}</ErrorNote>}
        {!active.length ? (
          <Empty title="No active or unacknowledged alarms" />
        ) : (
          <Table head={["Priority", "Tag", "Message", "Since", "State", "Actions"]} caption="Active alarm list">
            {active.map((a) => (
              <tr key={a.id}>
                <Td>
                  <Badge tone={PRI_TONE[a.priority]}>{a.priority.toUpperCase()}</Badge>
                </Td>
                <Td mono>{a.tag}</Td>
                <Td>
                  {a.message}
                  {a.shelveReason && <div className="text-xs text-muted">Shelved: {a.shelveReason}</div>}
                </Td>
                <Td mono>{a.since ? formatTime(a.since) : "-"}</Td>
                <Td>
                  <Badge tone={STATE_LABEL[a.state].tone}>{STATE_LABEL[a.state].label}</Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={!canAck || (a.state !== "UNACK_ACTIVE" && a.state !== "RTN_UNACK")} onClick={() => ack(a)} title="Software acknowledge. Does not reset the board.">
                      <Check aria-hidden className="h-4 w-4" /> Acknowledge (software)
                    </Button>
                    <Button disabled={!canAck || a.state === "SHELVED"} onClick={() => setShelve(a)}>
                      <Archive aria-hidden className="h-4 w-4" /> Shelve
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <KpiRow>
        <Kpi label="Alarms per 10 minutes" value={per10} sub="Target under 1 per 10 min (ISA-18.2)" tone={per10 > 1 ? "warn" : undefined} />
        <Kpi label="Standing alarms" value={standing} sub="Active for over 10 minutes" />
        <Kpi label="Chattering alarms" value={chattering} sub="3 or more activations in 1 minute" tone={chattering ? "warn" : undefined} />
        <Card title="Top 10 frequent alarms">
          {top10.length ? (
            <ol className="flex flex-col gap-1 text-sm">
              {top10.map(([t, c]) => (
                <li key={t} className="flex justify-between">
                  <Mono>{t}</Mono>
                  <Mono>{c}</Mono>
                </li>
              ))}
            </ol>
          ) : (
            <Empty title="No alarms yet" />
          )}
        </Card>
      </KpiRow>

      <Card
        title="Incident log"
        actions={
          <>
            <label htmlFor="inc-q" className="sr-only">
              Search incidents
            </label>
            <input id="inc-q" placeholder="Search incidents" value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} className={inputCls + " w-48"} />
            <label htmlFor="inc-pri" className="sr-only">
              Priority filter
            </label>
            <select id="inc-pri" value={filter.pri} onChange={(e) => setFilter((f) => ({ ...f, pri: e.target.value }))} className={inputCls + " w-36"}>
              <option value="all">All priorities</option>
              {(["critical", "high", "medium", "low"] as const).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </>
        }
      >
        {!incidents.length ? (
          <Empty title="No incidents match" />
        ) : (
          <Table head={["Alarm ID", "Timestamp", "Sensor Location", "Peak Reading", "Acknowledgement Status", "Action"]} caption="Incident log">
            {incidents.map((i) => (
              <tr key={i.id}>
                <Td mono>{i.id}</Td>
                <Td mono>{formatDateTime(i.at)}</Td>
                <Td>
                  {i.location} <Mono className="text-xs text-muted">{i.tag}</Mono>
                </Td>
                <Td mono>{i.peak}</Td>
                <Td>{i.ackStatus}</Td>
                <Td>
                  {i.action} {i.id.includes("DEMO") && <SimTag kind="Demo" />}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <ShelveModal alarm={shelve} onClose={() => setShelve(null)} />
    </Page>
  );
}
