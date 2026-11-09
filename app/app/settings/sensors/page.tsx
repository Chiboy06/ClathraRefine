"use client";
import { useState } from "react";
import { Wind } from "lucide-react";
import { Badge, Button, Card, ErrorNote, Notice, Page, Table, Td, postJson, useFetch } from "@/components/ui";
import { useMe } from "@/components/scada";
import { usePlant } from "@/lib/telemetry/usePlant";
import { getHub } from "@/lib/telemetry/hub";
import { calibrateR0, DEFAULT_CAL } from "@/lib/mq135";
import { can } from "@/lib/roleMatrix";
import { formatDateTime, num } from "@/lib/format";

type Cal = { id: string; sensor: string; r0Kohm: number; calibrated_at: number; by: string };

export default function Sensors() {
  const p = usePlant();
  const { me } = useMe();
  const cals = useFetch<Cal[]>("/api/sensors");
  const [running, setRunning] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const l = p.latest;
  const allowed = can(me?.session?.role, "approve_override");
  const cal = (s: string) => cals.data?.find((c) => c.sensor === s);

  // Averages 60 s of fresh-air readings, then stores R0 for 420 ppm.
  const calibrate = (sensor: "co2_in" | "co2_out") => {
    setRunning(sensor);
    setMsg(null);
    const start = getHub().getSnapshot().history.at(-1)?.receivedAt ?? 0;
    setTimeout(async () => {
      const field = sensor === "co2_in" ? "co2_in_mv" : "co2_out_mv";
      const mv = getHub()
        .getSnapshot()
        .history.filter((h) => h.receivedAt > start)
        .map((h) => h[field])
        .filter((x): x is number => typeof x === "number");
      const r0 = calibrateR0(mv);
      try {
        if (r0 === null) throw new Error("Not enough readings in 60 s. Check the sensor is connected.");
        await postJson("/api/sensors", { sensor, r0Kohm: +r0.toFixed(3), samples: mv.length });
        setMsg({ ok: true, t: `Calibrated ${sensor === "co2_in" ? "AT-103" : "AT-104"}: R0 ${r0.toFixed(2)} kΩ from ${mv.length} readings.` });
        cals.reload();
      } catch (e) {
        setMsg({ ok: false, t: (e as Error).message });
      } finally {
        setRunning(null);
      }
    }, 60_000);
  };

  const rows = [
    { tag: "AT-101", name: "Ambient gas", model: "MQ-2", pin: "GPIO 2", fitted: true, cal: "Clean-air baseline from Sensor health" },
    { tag: "AT-102", name: "Exhaust gas", model: "MQ-2", pin: "GPIO 1", fitted: true, cal: "Clean-air baseline from Sensor health" },
    { tag: "AT-103", name: "Inlet CO2", model: "MQ-135", pin: "GPIO 4", fitted: l?.co2_in_mv !== undefined, sensor: "co2_in" as const },
    { tag: "AT-104", name: "Outlet CO2", model: "MQ-135", pin: "GPIO 5", fitted: l?.co2_out_mv !== undefined, sensor: "co2_out" as const },
    { tag: "FT-301", name: "Gas flow", model: "Flow meter", pin: "Not assigned", fitted: p.mode === "LIVE" && l?.gas_lpm !== undefined, cal: "-" },
    { tag: "FT-302", name: "Solvent flow", model: "Flow meter", pin: "Not assigned", fitted: p.mode === "LIVE" && l?.liquid_lpm !== undefined, cal: "-" },
    { tag: "TT-303", name: "Solvent temperature", model: "Temperature probe", pin: "Not assigned", fitted: p.mode === "LIVE" && l?.solvent_c !== undefined, cal: "-" },
    { tag: "AIT-304", name: "Solvent pH", model: "pH probe", pin: "Not assigned", fitted: p.mode === "LIVE" && l?.ph !== undefined, cal: "-" },
  ];

  return (
    <Page title="Sensors and calibration" subtitle="What is fitted, on which pin, and its calibration.">
      {msg && (msg.ok ? <Notice tone="ok">{msg.t}</Notice> : <ErrorNote>{msg.t}</ErrorNote>)}
      <Card help={`CO2 sensors: Rs from the ${DEFAULT_CAL.rlKohm} kΩ load resistor, R0 from 60 s in fresh air at 420 ppm, ppm = 116.6 × (Rs/R0)^−2.77.`}>
        <Table head={["Tag", "Sensor", "Model", "Pin", "Fitted", "Calibration", "Last calibrated", ""]} caption="Sensors">
          {rows.map((r) => {
            const c = r.sensor ? cal(r.sensor) : undefined;
            return (
              <tr key={r.tag}>
                <Td mono>{r.tag}</Td>
                <Td>{r.name}</Td>
                <Td>{r.model}</Td>
                <Td mono>{r.pin}</Td>
                <Td>
                  <Badge tone={r.fitted ? "ok" : "neutral"}>{r.fitted ? "Fitted" : "Not fitted"}</Badge>
                </Td>
                <Td mono>{r.sensor ? `R0 ${num(c?.r0Kohm ?? DEFAULT_CAL.r0Kohm, 2)} kΩ${c ? "" : " (default)"}` : r.cal}</Td>
                <Td mono>{c ? formatDateTime(c.calibrated_at) : "-"}</Td>
                <Td>
                  {r.sensor && (
                    <Button disabled={!allowed || !!running} busy={running === r.sensor} onClick={() => calibrate(r.sensor!)}>
                      <Wind aria-hidden className="h-4 w-4" /> {running === r.sensor ? "Averaging 60 s…" : "Calibrate in fresh air"}
                    </Button>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </Page>
  );
}
