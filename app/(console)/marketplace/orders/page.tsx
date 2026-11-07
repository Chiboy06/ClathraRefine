"use client";
import { Card, Empty, ErrorNote, LoadingPanel, Page, SimTag, useFetch } from "@/components/ui";
import { Mono } from "@/components/scada";
import { OrderTrack, useMoney, type Order } from "@/components/market";
import { formatDateTime } from "@/lib/format";

export default function Orders() {
  const r = useFetch<Order[]>("/api/market/orders");
  const money = useMoney();
  return (
    <Page title="My orders" subtitle={<>An order is Paid only after a verified Paystack webhook and a matching verify call. Test mode <SimTag kind="Demo" /></>}>
      {r.loading && <LoadingPanel />}
      {r.error && <ErrorNote>{r.error}</ErrorNote>}
      {r.data && !r.data.length && <Empty title="No orders yet">Add products from the marketplace and pay with a Paystack test card.</Empty>}
      {r.data?.map((o) => (
        <Card key={o.id} title={<>Order <Mono>{o.id.slice(0, 8)}</Mono></>} actions={<Mono className="text-sm">{money(o.total_kobo)}</Mono>}>
          <OrderTrack status={o.status} />
          <ul className="mt-4 flex flex-col gap-1 text-sm">
            {o.items.map((i, k) => (
              <li key={k}>
                {i.qty} × {i.title} ({i.packaging})
              </li>
            ))}
          </ul>
          <div className="mt-2 text-xs text-muted">
            Placed {formatDateTime(o.created_at)} · delivery {o.location}
          </div>
        </Card>
      ))}
    </Page>
  );
}
