"use client";
import { Badge, Card, Empty, ErrorNote, LoadingPanel, Page, Table, Td, useFetch } from "@/components/ui";
import { useMoney } from "@/components/market";
import { formatDateTime } from "@/lib/format";
import type { PricedLine } from "@/lib/cart";

type Rfq = { id: string; rfq_id: string; created_at: number; buyer_name: string; lines: PricedLine[]; total_kobo: number; status: string; escrow_slot: string; location: string };

export default function RfqList() {
  const r = useFetch<Rfq[]>("/api/market/rfq");
  const money = useMoney();
  return (
    <Page title="Requests for quotation" subtitle="RFQs lock an escrow slot under the planned settlement model. No money moves until the seller quotes.">
      <Card>
        {r.loading && <LoadingPanel />}
        {r.error && <ErrorNote>{r.error}</ErrorNote>}
        {r.data && !r.data.length && <Empty title="No RFQs yet">Submit one from the cart drawer.</Empty>}
        {!!r.data?.length && (
          <Table head={["RFQ", "Submitted", "Buyer", "Items", "Indicative total", "Escrow slot", "Status"]} caption="RFQs">
            {r.data.map((q) => (
              <tr key={q.id}>
                <Td mono>{q.rfq_id}</Td>
                <Td mono>{formatDateTime(q.created_at)}</Td>
                <Td>{q.buyer_name}</Td>
                <Td>{q.lines.map((l) => `${l.qty} × ${l.title}`).join("; ")}</Td>
                <Td mono>{money(q.total_kobo)}</Td>
                <Td mono>{q.escrow_slot}</Td>
                <Td>
                  <Badge tone="primary">{q.status}</Badge>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </Page>
  );
}
