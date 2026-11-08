"use client";
import Link from "next/link";
import { Check } from "lucide-react";
import { Badge, SimTag, Table, Td, cx, useMounted } from "./ui";
import { SPOT_RATES, TIERS } from "@/lib/demoData";
import { REBATE } from "@/lib/cart";
import { usePrefs } from "@/lib/store";
import { formatMoney } from "@/lib/format";

export function PricingTables() {
  const mounted = useMounted();
  const currency = usePrefs((s) => s.currency);
  const rate = usePrefs((s) => s.rate);
  const money = (k: number) => formatMoney(k, mounted ? currency : "NGN", rate);
  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {TIERS.map((t) => (
          <section key={t.name} aria-label={t.name} className={cx("flex flex-col rounded-2xl border bg-panel p-8", t.popular ? "border-2 border-primary" : "border-line")}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-semibold tracking-[-0.01em]">{t.name}</h2>
              {t.popular && <Badge tone="primary">Most Popular</Badge>}
            </div>
            <div className="mt-6 font-mono text-4xl font-semibold tabular tracking-[-0.02em]">
              {t.kobo ? money(t.kobo) : "Custom"}
              <span className="font-sans text-base font-normal text-muted">{t.kobo ? t.note : ` ${t.note}`}</span>
            </div>
            <ul className="mt-8 flex flex-1 flex-col gap-3">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ok-fg" /> {f}
                </li>
              ))}
            </ul>
            <Link href={t.kobo ? "/sign-up" : "/contact"} className={cx("mt-8 inline-flex min-h-11 items-center justify-center rounded-full px-5 font-semibold", t.popular ? "bg-primary text-white hover:bg-primary/90" : "border border-line hover:bg-elev")}>
              {t.kobo ? "Start with this plan" : "Book a demo"}
            </Link>
          </section>
        ))}
      </div>
      <section aria-labelledby="spot-h" className="mt-16 rounded-2xl border border-line bg-panel p-6 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 id="spot-h" className="text-2xl font-semibold tracking-[-0.015em]">
            Gas offtake spot rates
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="ok">
              Volume rebate: above {REBATE.aboveMt} MT, {REBATE.pct * 100}% off
            </Badge>
            <SimTag kind="Demo" />
          </div>
        </div>
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
      </section>
    </>
  );
}
