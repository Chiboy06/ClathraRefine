"use client";
import { use } from "react";
import { Badge, Card, Empty, ErrorNote, Kpi, KpiRow, LoadingPanel, Notice, Page, SimTag, Table, Td, useFetch } from "@/components/ui";
import { Mono } from "@/components/scada";
import { DataStatus, ScrubberBadge, useBoard } from "@/components/plant";
import { formatDateTime, formatTime } from "@/lib/format";
import { usePrefs } from "@/lib/store";

type Cmd = { id: string; created_at: number; kind: string; mode: string; requested_name: string; status: string };

export default function Device({ params }: { params: Promise<{ thing: string }> }) {
  const { thing } = use(params);
  const name = decodeURIComponent(thing);
  const { p, l } = useBoard();
  const mode = usePrefs((s) => s.mode);
  const cmds = useFetch<Cmd[]>("/api/overrides?view=commands");
  const isBoard = name === "ESP32S3-N16R8-HARNESS-01";
  const buffered = p.history.filter((h) => h.buffered).length;

  if (!isBoard)
    return (
      <Page title={name} subtitle={<>Fictional demo device <SimTag kind="Demo" /></>}>
        <Notice tone="neutral">This is a demo site device. Only ESP32S3-N16R8-HARNESS-01 is real hardware.</Notice>
      </Page>
    );

  return (
    <Page title={name} subtitle={`ESP32-S3-WROOM-1-N16R8 · AWS IoT Core eu-west-1 · ${mode === "DEMO" ? "DEMO scenario" : "LIVE"}`}>
      <DataStatus />
      <KpiRow>
        <Kpi label="Last seen" value={p.link.lastAt ? formatTime(p.link.lastAt) : "never"} sub={`${p.link.perMinute} messages per minute`} tag={mode === "DEMO" ? <SimTag kind="Demo" /> : undefined} />
        <Kpi label="Connection" value={<Badge tone={p.link.connected ? "ok" : "crit"} size="lg">{p.link.connected ? "Connected" : "Offline"}</Badge>} sub={p.status.error ?? "MQTT over TLS, port 8883"} />
        <Kpi label="Firmware" value={l?.fw ?? "-"} sub={l ? `Uptime ${Math.round(l.uptime_ms / 1000)} s` : "No reading"} />
        <Kpi label="Buffered readings" value={buffered} sub="Readings that arrived late from the PSRAM buffer this session" />
      </KpiRow>
      <Card title="Health flags">
        <div className="flex flex-wrap gap-3">
          <Badge tone={l?.sensor_fault ? "crit" : "ok"} size="lg">
            {l?.sensor_fault ? "Sensor fault" : "Sensor fault clear"}
          </Badge>
          <Badge tone={l?.warming_up ? "warn" : "ok"} size="lg">
            {l?.warming_up ? "Warming up (180 s)" : "Warm-up complete"}
          </Badge>
          <Badge tone={l?.check_sensor ? "crit" : "ok"} size="lg">
            {l?.check_sensor ? "Check sensor (< 100 mV)" : "Readings above 100 mV"}
          </Badge>
          <Badge tone={l?.trip_latched ? "crit" : "ok"} size="lg">
            {l?.trip_latched ? "Trip latched" : "Trip clear"}
          </Badge>
          <ScrubberBadge s={l?.scrubber} />
          <Badge tone="neutral" size="lg">
            relay_mask <Mono>{l ? `0b${l.relay_mask.toString(2).padStart(6, "0")}` : "-"}</Mono>
          </Badge>
        </div>
      </Card>
      <Card title="Command history (SCRAM and ping)">
        {cmds.loading && <LoadingPanel />}
        {cmds.error && <ErrorNote>{cmds.error}</ErrorNote>}
        {cmds.data && !cmds.data.length && <Empty title="No commands sent yet" />}
        {!!cmds.data?.length && (
          <Table head={["Time", "Command", "Mode", "By", "Result"]} caption="Command history">
            {cmds.data.map((c) => (
              <tr key={c.id}>
                <Td mono>{formatDateTime(c.created_at)}</Td>
                <Td mono>{`{"cmd":"${c.kind}"}`}</Td>
                <Td>
                  <Badge tone={c.mode === "LIVE" ? "crit" : "warn"}>{c.mode}</Badge>
                </Td>
                <Td>{c.requested_name}</Td>
                <Td>{c.mode === "LIVE" ? "Published to IoT Core; confirm from telemetry" : "Applied to DEMO scenario"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </Page>
  );
}
