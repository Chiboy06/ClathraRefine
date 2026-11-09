"use client";
import { useState } from "react";
import { BellOff, Hand, SlidersHorizontal } from "lucide-react";
import { Button, Card, Field, Page, SimTag, Badge, Table, Td, inputCls } from "@/components/ui";
import { useMe } from "@/components/scada";
import { OverrideRequestModal, PendingApprovals, type OverrideSpec } from "@/components/safety";
import { ALARM_DEFS } from "@/lib/alarmDefs";
import { TAGS } from "@/lib/tags";
import { FW } from "@/lib/process";
import { can } from "@/lib/roleMatrix";

export default function AlarmLimits() {
  const { me } = useMe();
  const [spec, setSpec] = useState<OverrideSpec | null>(null);
  const [n, setN] = useState(0);
  const [warn, setWarn] = useState<number>(FW.AMB_WARN_ON_MV);
  const [crit, setCrit] = useState<number>(FW.AMB_CRIT_ON_MV);
  const [mins, setMins] = useState(10);
  const canRequest = can(me?.session?.role, "request_override");
  return (
    <Page title="Alarm limits" subtitle="Alarm definitions, display lines and safety bypasses. Changes need a second supervisor.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Display alert lines" help="These move the lines drawn on charts only. The board's own trip thresholds are fixed in firmware and cannot be changed from the app.">
          <div className="grid grid-cols-2 gap-4">
            <Field id="lim-warn" label="Warning line (mV)">
              <input id="lim-warn" type="number" value={warn} onChange={(e) => setWarn(Number(e.target.value))} className={inputCls} />
            </Field>
            <Field id="lim-crit" label="Critical line (mV)">
              <input id="lim-crit" type="number" value={crit} onChange={(e) => setCrit(Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={!canRequest} onClick={() => setSpec({ kind: "setting", target: "display_warn_mv", value: warn, title: "Change the warning display line", consequence: `Charts draw the warning line at ${warn} mV. The board is unchanged.` })}>
              <SlidersHorizontal aria-hidden className="h-4 w-4" /> Request warning line
            </Button>
            <Button disabled={!canRequest} onClick={() => setSpec({ kind: "setting", target: "display_crit_mv", value: crit, title: "Change the critical display line", consequence: `Charts draw the critical line at ${crit} mV. The board is unchanged.` })}>
              <SlidersHorizontal aria-hidden className="h-4 w-4" /> Request critical line
            </Button>
          </div>
        </Card>
        <Card title="Safety bypass" help="Muting the siren from the app, or keeping manual mode on while a hazard is active. Needs a different supervisor, a reason and an automatic expiry. In LIVE mode these show as requiring firmware support.">
          <Field id="byp-min" label="Expires after (minutes)">
            <input id="byp-min" type="number" min={1} max={60} value={mins} onChange={(e) => setMins(Number(e.target.value))} className={inputCls + " w-32"} />
          </Field>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="danger" disabled={!canRequest} onClick={() => setSpec({ kind: "siren_mute", target: "siren", value: mins, title: "Bypass: mute the siren", consequence: `The siren is muted for ${mins} min while the hazard is active. The red strobe and the trip stay latched.` })}>
              <BellOff aria-hidden className="h-4 w-4" /> Request siren mute
            </Button>
            <Button variant="danger" disabled={!canRequest} onClick={() => setSpec({ kind: "manual_extend", target: "manual", value: mins, title: "Bypass: extend manual mode", consequence: `Manual mode stays on for ${mins} more min while a hazard is active. Automatic safety still returns on a trip, SCRAM or sensor fault.` })}>
              <Hand aria-hidden className="h-4 w-4" /> Request manual extension
            </Button>
          </div>
        </Card>
      </div>
      <Card title="Pending approvals">
        <PendingApprovals refreshKey={n} />
      </Card>
      <Card title="Alarm definitions">
        <Table head={["Alarm", "Tag", "Priority", "Set", "Clear", "Source"]} caption="Alarm definitions">
          {ALARM_DEFS.map((a) => (
            <tr key={a.id}>
              <Td mono>{a.id}</Td>
              <Td mono>{a.tag}</Td>
              <Td>{a.pri}</Td>
              <Td mono>{a.set}</Td>
              <Td mono>{a.clear}</Td>
              <Td>{a.src}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title="Tag list">
        <Table head={["Tag", "Name", "Unit", "Range", "Limits", "Source"]} caption="Tag list">
          {TAGS.map((t) => (
            <tr key={t.id}>
              <Td mono>{t.id}</Td>
              <Td>{t.name}</Td>
              <Td>{t.unit}</Td>
              <Td mono>
                {t.min} to {t.max}
              </Td>
              <Td mono>{[t.lo !== undefined && `L ${t.lo}`, t.hi !== undefined && `H ${t.hi}`, t.hihi !== undefined && `HH ${t.hihi}`].filter(Boolean).join(" · ") || "-"}</Td>
              <Td>{t.source === "board" ? <Badge tone="ok">Board</Badge> : <SimTag />}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <OverrideRequestModal spec={spec} onClose={() => setSpec(null)} onDone={() => setN((x) => x + 1)} />
    </Page>
  );
}
