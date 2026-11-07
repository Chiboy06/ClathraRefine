import Link from "next/link";
import { ArrowRight, Cpu, Recycle, ShieldAlert, Store } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/publicNav";
import { ProcessFlow, STAGES } from "@/components/flow";
import { SimTag } from "@/components/ui";

const METRICS = [
  { v: "4,820 MT", l: "CO2 Abated" },
  { v: "98.7%", l: "Sweetening Yield" },
  { v: "₦18.4M", l: "Revenue Generated" },
  { v: "99.98%", l: "Interlock Uptime" },
];

const PROPS = [
  { icon: ShieldAlert, t: "Edge Gas Mitigation", d: "An ESP32-S3 controller trips red strobe and siren on its own thresholds, with hysteresis, a latched trip and a physical acknowledge button. It never waits for the network." },
  { icon: Cpu, t: "2-Second Staggered Scrubber Automation", d: "Gas at the exhaust starts the intake fan, the solvent pump follows 2.0 s later, and a 5.0 s purge runs when the gas clears. Every transition is streamed to AWS." },
  { icon: Recycle, t: "Circular B2B Commodity Offtake", d: "Recovered CO2, biomethane, carbon tokens and carbonate solution are listed on the same platform, each linked to the production data that made it." },
];

export default function Landing() {
  return (
    <>
      <PublicHeader />
      <main id="main">
        <section className="mx-auto max-w-7xl px-6 pb-12 pt-16 md:px-8 lg:px-10">
          <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-fluid-fg">Industrial SCADA · Modular mini-refineries</p>
          <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">Closed-Loop Flue Gas Sweetening &amp; Circular Carbon Valorization.</h1>
          <p className="mt-6 max-w-3xl text-lg text-muted">
            ClathraRefine runs a modular mini-refinery as a chain of skids: flue gas from the furnace is chilled, scrubbed in a packed absorption column with a caustic solvent, analysed, and the recovered product is stored for sale. Edge controllers own
            safety on site, AWS IoT Core carries every reading, and a built-in B2B marketplace sells what the plant recovers with proof of origin.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 font-semibold text-white hover:bg-primary/90">
              Launch SCADA Console <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
            <Link href="/marketplace" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate px-5 font-semibold text-white hover:bg-slate/90">
              <Store aria-hidden className="h-4 w-4" /> Browse Gas Marketplace
            </Link>
          </div>
        </section>

        <section aria-labelledby="flow-h" className="mx-auto max-w-7xl px-6 md:px-8 lg:px-10">
          <div className="rounded-lg border border-line bg-panel p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 id="flow-h" className="text-sm font-semibold uppercase tracking-wide text-muted">
                Process flow
              </h2>
              <SimTag kind="Demo" />
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <ProcessFlow active={new Set(STAGES.map((s) => s.id))} />
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="metrics-h" className="mx-auto max-w-7xl px-6 pt-12 md:px-8 lg:px-10">
          <div className="mb-4 flex items-center gap-2">
            <h2 id="metrics-h" className="text-sm font-semibold uppercase tracking-wide text-muted">
              Metric highlights
            </h2>
            <SimTag kind="Demo" />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {METRICS.map((m) => (
              <div key={m.l} className="rounded-lg border border-line bg-panel p-6">
                <div className="font-mono text-3xl font-bold tabular">{m.v}</div>
                <div className="mt-1 text-sm text-muted">{m.l}</div>
                <div className="mt-3 text-[11px] text-muted">Demo-scenario figure</div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="props-h" className="mx-auto max-w-7xl px-6 pt-12 md:px-8 lg:px-10">
          <h2 id="props-h" className="sr-only">
            Value propositions
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PROPS.map((p) => (
              <div key={p.t} className="rounded-lg border border-line bg-panel p-6">
                <p.icon aria-hidden className="h-6 w-6 text-fluid-fg" />
                <h3 className="mt-4 text-lg font-bold">{p.t}</h3>
                <p className="mt-2 text-sm text-muted">{p.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
