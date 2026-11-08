"use client";
import Link from "next/link";
import { Fan, Store, Waves } from "lucide-react";
import { Badge, Card, Kpi, KpiRow, LoadingPanel, Page, SimTag, Table, Td } from "@/components/ui";
import { AnalogueBar, Mono } from "@/components/scada";
import { DataStatus, ScrubberBadge, useBoard } from "@/components/plant";
import { tag } from "@/lib/tags";
import { relayOn } from "@/lib/fsm";
import { num } from "@/lib/format";
import { solventCapacityGPerL } from "@/lib/process";
import { CAPTURE_LOTS } from "@/lib/lots";

export default function Capture() {
  const { p, l } = useBoard();
  const pl = p.plant;
  const hoursToday = p.now ? (p.now % 86_400_000) / 3_600_000 : 0;
  return (
    <Page title="Solvent and scrubber" subtitle="What the scrubber is doing now, how loaded the solvent is, and the lots it has produced.">
      <DataStatus />
      {!p.ready ? (
        <LoadingPanel rows={4} />
      ) : (
        <KpiRow>
          <Kpi label="Scrubber state" value={<ScrubberBadge s={l?.scrubber} />} sub="From the edge controller (firmware state)">
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge tone={relayOn(p.relayMask, 1) ? "fluid" : "neutral"} icon={false}>
                <Fan aria-hidden className="h-3.5 w-3.5" /> Fan {relayOn(p.relayMask, 1) ? "on" : "off"}
              </Badge>
              <Badge tone={relayOn(p.relayMask, 2) ? "fluid" : "neutral"} icon={false}>
                <Waves aria-hidden className="h-3.5 w-3.5" /> Pump {relayOn(p.relayMask, 2) ? "on" : "off"}
              </Badge>
            </div>
          </Kpi>
          <Kpi label="Solvent loading" value={`${num(pl.loadingPct, 1)}%`} sub={`Of ${solventCapacityGPerL().toFixed(2)} g/L carbonate capacity`} tag={<SimTag />}>
            <div className="mt-3">
              <AnalogueBar tag={tag("LT-401")} value={pl.loadingPct} label="Solvent loading against range" />
            </div>
          </Kpi>
          <Kpi label="Capture efficiency" value={`${num(pl.efficiency, 2)}%`} sub="η = (C_in − C_out) / C_in" tag={<SimTag />} />
          <Kpi label="Captured today" value={`${num((pl.captureKgH * hoursToday) / 1000, 2)} t`} sub={`At ${num(pl.captureKgH, 1)} kg/h since 00:00 UTC`} tag={<SimTag />} />
        </KpiRow>
      )}
      <Card title="Capture lots" actions={<SimTag kind="Demo" />}>
        <p className="mb-4 text-sm text-muted">Every marketplace listing starts from a lot, so buyers see where and when it was captured.</p>
        <Table head={["Lot", "Product", "Captured at", "Dates", "Quantity", "Source tag", ""]} caption="Capture lots">
          {CAPTURE_LOTS.map((lot) => (
            <tr key={lot.lot_id}>
              <Td mono>{lot.lot_id}</Td>
              <Td>{lot.product}</Td>
              <Td>{lot.site}</Td>
              <Td>
                {lot.from === lot.to ? lot.from : `${lot.from} to ${lot.to}`}
              </Td>
              <Td mono>{lot.quantity}</Td>
              <Td>
                <Mono>{lot.tag}</Mono>
              </Td>
              <Td>
                <Link href={`/app/marketplace/seller?lot=${encodeURIComponent(lot.lot_id)}`} className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-line px-3 text-sm font-semibold hover:bg-elev">
                  <Store aria-hidden className="h-4 w-4" /> Create listing
                </Link>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </Page>
  );
}
