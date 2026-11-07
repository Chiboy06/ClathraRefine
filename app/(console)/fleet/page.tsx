"use client";
import Link from "next/link";
import { Badge, Card, ErrorNote, LoadingPanel, Page, QualityBadge, SimTag, Table, Td, useFetch } from "@/components/ui";
import { Mono } from "@/components/scada";
import { DataStatus, LevelBadge, useBoard } from "@/components/plant";
import { formatTime, num } from "@/lib/format";
import { PRIORITY_RANK, type Priority } from "@/lib/alarms";

type Site = { id: string; name: string; thing: string; real: boolean; region: string };

/** Deterministic demo values per fictional site, so 10 sites × 50 tags stays cheap to render. */
function demoSite(thing: string, now: number) {
  const s = [...thing].reduce((a, c) => a + c.charCodeAt(0), 0);
  const amb = Math.round(470 + 30 * Math.sin(now / 9e4 + s));
  const crit = s % 5 === 0 ? 1 : 0;
  return { amb, alarms: { critical: crit, high: s % 3 === 0 ? 1 : 0, medium: s % 2, low: 0 }, level: crit ? "WARNING" : "NORMAL", seen: now - (s % 7) * 1000 };
}

export default function Fleet() {
  const { p, l, ambient } = useBoard();
  const r = useFetch<Site[]>("/api/sites");
  const counts = p.alarms.filter((a) => a.state !== "NORMAL" && a.state !== "SHELVED").reduce((acc, a) => ({ ...acc, [a.priority]: (acc[a.priority] ?? 0) + 1 }), {} as Partial<Record<Priority, number>>);
  const now = p.now;
  return (
    <Page title="Fleet" subtitle="All sites and devices. One real site (the bench skid) plus fictional demo sites.">
      <DataStatus />
      <Card>
        {r.loading && <LoadingPanel />}
        {r.error && <ErrorNote>{r.error}</ErrorNote>}
        {r.data && (
          <Table head={["Site", "Device", "Connection", "Active alarms", "Ambient (AT-101)", "Level", "Last seen"]} caption="Fleet overview">
            {r.data.map((s) => {
              const real = s.real && s.thing === "ESP32S3-N16R8-HARNESS-01";
              const d = real ? null : demoSite(s.thing, now);
              const al = real ? counts : d!.alarms;
              return (
                <tr key={s.id}>
                  <Td>
                    <div className="font-semibold">{s.name}</div>
                    {!real && <SimTag kind="Demo" />}
                  </Td>
                  <Td mono>
                    <Link href={`/devices/${encodeURIComponent(s.thing)}`} className="hover:underline">
                      {s.thing}
                    </Link>
                  </Td>
                  <Td>{real ? <Badge tone={p.link.connected ? "ok" : "crit"}>{p.link.connected ? "Connected" : "Offline"}</Badge> : <Badge tone="ok">Connected</Badge>}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {(Object.keys(PRIORITY_RANK) as Priority[]).map((k) =>
                        al[k] ? (
                          <Badge key={k} tone={k === "critical" ? "crit" : k === "high" ? "warn" : "primary"}>
                            {al[k]} {k}
                          </Badge>
                        ) : null,
                      )}
                      {!Object.values(al).some(Boolean) && <span className="text-sm text-muted">None</span>}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Mono>{num(real ? ambient.mv : d!.amb)} mV</Mono>
                      <QualityBadge q={real ? ambient.q : "Good"} />
                    </div>
                  </Td>
                  <Td>
                    <LevelBadge level={real ? l?.ambient_level : d!.level} />
                  </Td>
                  <Td mono>{real ? (p.link.lastAt ? formatTime(p.link.lastAt) : "never") : formatTime(d!.seen)}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </Page>
  );
}
