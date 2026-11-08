"use client";
import { useState } from "react";
import { Badge, Card, Empty, ErrorNote, inputCls, LoadingPanel, Page, Table, Td, useFetch } from "@/components/ui";
import { CopyText } from "@/components/scada";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/server/audit";

export default function AuditLog() {
  const r = useFetch<{ rows: AuditEntry[]; intact: boolean }>("/api/audit-log");
  const [q, setQ] = useState("");
  const rows = (r.data?.rows ?? []).filter((e) => !q || `${e.actor_name} ${e.action} ${e.target} ${e.detail ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page title="Audit trail" subtitle="Append-only record of who did what, when and with what outcome. Each entry's SHA-256 covers the previous one.">
      <Card
        actions={
          <>
            {r.data && <Badge tone={r.data.intact ? "ok" : "crit"}>{r.data.intact ? "Hash chain intact" : "Hash chain broken"}</Badge>}
            <label htmlFor="al-q" className="sr-only">
              Filter audit trail
            </label>
            <input id="al-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by person, action or target" className={inputCls + " w-64"} />
          </>
        }
      >
        {r.loading && <LoadingPanel rows={6} />}
        {r.error && <ErrorNote>{r.error}</ErrorNote>}
        {r.data && !rows.length && <Empty title="No audit entries yet" />}
        {!!rows.length && (
          <Table head={["Time", "Who", "Role", "Action", "Target", "Outcome", "Detail", "Hash"]} caption="Audit trail">
            {rows.map((e) => (
              <tr key={e.id}>
                <Td mono>{formatDateTime(e.created_at)}</Td>
                <Td>{e.actor_name}</Td>
                <Td>{e.role}</Td>
                <Td mono>{e.action}</Td>
                <Td mono className="max-w-48 break-all">
                  {e.target}
                </Td>
                <Td>
                  <Badge tone={e.outcome === "ok" ? "ok" : e.outcome === "pending" ? "warn" : "crit"}>{e.outcome}</Badge>
                </Td>
                <Td className="max-w-64 break-words text-xs text-muted">{e.detail}</Td>
                <Td>
                  <CopyText text={e.hash} short={8} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </Page>
  );
}
