"use client";
import Link from "next/link";
import { Check } from "lucide-react";
import { Badge, Card, Page, SimTag, Table, Td, cx } from "@/components/ui";
import { useMoney } from "@/components/market";
import { SPOT_RATES, TIERS } from "@/lib/demoData";
import { REBATE } from "@/lib/cart";

export default function Pricing() {
  const money = useMoney();
  return (
    <Page title="Platform SaaS and commodity pricing" subtitle={<>Prices are Demo figures <SimTag kind="Demo" /></>}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {TIERS.map((t) => (
          <Card key={t.name} tone={t.popular ? "primary" : undefined} className={cx("flex flex-col", t.popular && "border-2")}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold">{t.name}</h2>
              {t.popular && <Badge tone="primary">Most Popular</Badge>}
            </div>
            <div className="mt-4 font-mono text-3xl font-bold tabular">
              {t.kobo ? money(t.kobo) : "Custom"}
              <span className="text-base font-normal text-muted">{t.kobo ? t.note : ` ${t.note}`}</span>
            </div>
            <ul className="mt-6 flex flex-1 flex-col gap-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ok-fg" /> {f}
                </li>
              ))}
            </ul>
            <Link href={t.kobo ? "/sign-up" : "/support"} className={cx("mt-6 inline-flex min-h-10 items-center justify-center rounded-md px-4 font-semibold", t.popular ? "bg-primary text-white hover:bg-primary/90" : "border border-line hover:bg-elev")}>
              {t.kobo ? "Start with this plan" : "Talk to us"}
            </Link>
          </Card>
        ))}
      </div>
      <Card title="Gas offtake spot rates" actions={<Badge tone="ok">Volume rebate: above {REBATE.aboveMt} MT, {REBATE.pct * 100}% off</Badge>}>
        <Table head={["Product", "Unit", "Spot price", `Above ${REBATE.aboveMt} MT`, "Delivery terms"]} caption="Spot rates">
          {SPOT_RATES.map((r) => (
            <tr key={r.product}>
              <Td>{r.product}</Td>
              <Td>{r.unit}</Td>
              <Td mono>{r.kobo ? money(r.kobo) : "On request"}</Td>
              <Td mono>{r.kobo && r.unit.includes("MT") ? money(Math.round(r.kobo * (1 - REBATE.pct))) : "n/a"}</Td>
              <Td>{r.terms}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </Page>
  );
}
