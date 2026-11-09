"use client";
import Link from "next/link";
import { Badge, Card, LoadingPanel, Page, Table, Td } from "@/components/ui";
import { usePlant } from "@/lib/telemetry/usePlant";
import { sensorsHealth } from "@/lib/plantView";

export default function SensorHealth() {
  const p = usePlant();
  if (!p.ready) return <Page title="Sensor health"><LoadingPanel rows={4} /></Page>;
  const rows = sensorsHealth(p);
  return (
    <Page title="Sensor health" subtitle="Drift and failure checks from each sensor's clean-air baseline. Advisory.">
      <Card help="Suspect: below 100 mV, or no change for 10 minutes. Drifting: baseline moved over 25% from calibration. Model version: rules v1.">
        <Table head={["Sensor", "Status", "Evidence"]} caption="Sensor health">
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>
                <span className="font-mono">{r.id}</span> {r.name}
              </Td>
              <Td>
                <Badge tone={r.health.status === "OK" ? "ok" : r.health.status.startsWith("Drifting") ? "warn" : "crit"}>{r.health.status}</Badge>
              </Td>
              <Td>{r.health.evidence}</Td>
            </tr>
          ))}
        </Table>
        <p className="mt-4 text-sm">
          <Link href="/app/settings/sensors" className="font-semibold text-primary-fg hover:underline">
            Calibrate a sensor
          </Link>
        </p>
      </Card>
    </Page>
  );
}
