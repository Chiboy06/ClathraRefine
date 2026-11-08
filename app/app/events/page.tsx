"use client";
import { useState } from "react";
import { Card, Empty, inputCls, LoadingPanel, Page, Segmented } from "@/components/ui";
import { DataStatus, EventLog, useBoard } from "@/components/plant";
import type { Severity } from "@/lib/telemetry/hub";

export default function Events() {
  const { p } = useBoard();
  const [sev, setSev] = useState<"ALL" | Severity>("ALL");
  const [q, setQ] = useState("");
  const rows = p.events.filter((e) => (sev === "ALL" || e.severity === sev) && (!q || `${e.tag} ${e.message}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Page title="Event journal" subtitle="Board events derived from telemetry on every change, plus app events (commands, approvals, audits).">
      <DataStatus />
      <Card
        actions={
          <>
            <Segmented label="Severity" value={sev} onChange={setSev} options={(["ALL", "CRITICAL", "WARNING", "INFO", "PASS", "AUDIT"] as const).map((s) => ({ value: s, label: s }))} />
            <label htmlFor="ev-q" className="sr-only">
              Search events
            </label>
            <input id="ev-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tag or message" className={inputCls + " w-56"} />
          </>
        }
      >
        {!p.ready ? <LoadingPanel rows={8} /> : rows.length ? <EventLog events={rows} limit={300} /> : <Empty title="No events match" />}
      </Card>
    </Page>
  );
}
