import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { Container, CtaLink, Shot } from "@/components/site";
import { HeroCurve } from "@/components/heroCurve";
import { CAPABILITIES, INDUSTRIES, PILOT, PRODUCTS_PAGES, SITE } from "@/lib/siteContent";
import { TIERS } from "@/lib/demoData";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = {
  title: { absolute: `${SITE.name}: see gas hazards coming, stop leaks at the source` },
  description: SITE.description,
  alternates: { canonical: "/" },
};

const STORY = [
  { slug: "prediction", h: "Predict", line: "Know a leak is coming 30 seconds before the alarm.", body: "Every sensor reports every 2 seconds. A forecaster projects the next 30 seconds and an anomaly detector flags readings that are unusual for clean air, so the crossing shows up on screen while there is still time to act." },
  { slug: "prevention", h: "Prevent", line: "The controller on site acts in milliseconds, with or without the cloud.", body: "Staged alarms with hysteresis, a latched trip, the siren, SCRAM, extraction and scrubbing all run on the edge controller. A trip resets only with the physical button once readings are normal." },
  { slug: "capture", h: "Capture", line: "Extracted gas goes through a solvent scrubber, not into the air.", body: "A packed column with caustic solvent absorbs CO2. Removal efficiency, the mass balance, solvent loading and the captured mass are tracked hour by hour." },
  { slug: "marketplace", h: "Recover value", line: "Sell what you capture, with the data that proves it.", body: "Captured CO2 and recovered by-products are listed for other companies on the same platform. Every lot shows where and when it was captured and the sensor data behind it." },
] as const;

const FLOW = [
  { h: "Sensor", p: "Gas sensors at the exhaust and in the ambient air, read every 100 ms and averaged." },
  { h: "Edge controller", p: "Decides locally: alarms, trip, siren, SCRAM, fan and pump sequencing." },
  { h: "Cloud", p: "Readings stream over MQTT with TLS to AWS IoT Core and are stored for 30 days, with a raw archive for training." },
  { h: "App", p: "Prediction, alarm management, capture reporting, audits and two-person approvals." },
  { h: "Marketplace", p: "Lots become listings with provenance, quotes, invoices and payment." },
];

export default function Home() {
  return (
    <>
      <section className="pb-16 pt-14 md:pb-24 md:pt-20">
        <Container>
          <h1 className="max-w-4xl text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.035em] [text-wrap:balance]">See gas hazards coming. Stop leaks at the source.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">
            ClathraRefine predicts a gas hazard before it crosses an alarm threshold, acts on site in milliseconds, captures the CO2 it extracts and turns that carbon into revenue.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaLink href="/contact">Book a demo</CtaLink>
            <CtaLink href="/app" variant="secondary">
              Explore the live demo plant <ArrowRight aria-hidden className="h-4 w-4" />
            </CtaLink>
          </div>
          <div className="mt-12 rounded-3xl border border-line bg-panel p-4 md:p-8">
            <HeroCurve />
            <p className="mt-2 text-sm text-muted">Illustration from the ClathraRefine scenario engine. The forecast reaches the trip threshold first; extraction starts and the leak never becomes an alarm.</p>
          </div>
        </Container>
      </section>

      <section aria-labelledby="problem-h" className="border-y border-line bg-panel py-16 md:py-24">
        <Container className="grid gap-10 md:grid-cols-2">
          <h2 id="problem-h" className="text-[2rem] font-semibold leading-tight tracking-[-0.02em] md:text-[2.5rem]">
            By the time a fixed alarm sounds, the gas is already in the room.
          </h2>
          <div className="flex flex-col gap-4 text-lg leading-relaxed text-muted">
            <p>Refineries, gas plants, LPG depots and boiler houses live with leaks at pumps, flanges and loading points. Fixed thresholds only react once a reading is high. Cloud dashboards add delay. And the gas that is extracted is usually vented or flared.</p>
            <p>ClathraRefine closes that loop: it warns earlier, acts locally, and captures what it removes.</p>
          </div>
        </Container>
      </section>

      {STORY.map((s, i) => {
        const page = PRODUCTS_PAGES.find((p) => p.slug === s.slug)!;
        const dark = s.slug === "prevention";
        return (
          <section key={s.slug} aria-labelledby={`${s.slug}-h`} data-theme={dark ? "night" : undefined} className={dark ? "bg-canvas py-20 text-fg md:py-28" : "py-20 md:py-28"}>
            <Container className={`grid items-center gap-12 lg:grid-cols-2 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
              <div>
                <h2 id={`${s.slug}-h`} className="text-[2.5rem] font-semibold leading-tight tracking-[-0.025em] md:text-[3rem]">
                  {s.h}
                </h2>
                <p className="mt-3 text-xl font-semibold leading-snug">{s.line}</p>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">{s.body}</p>
                <Link href={`/product/${s.slug}`} className="mt-6 inline-flex items-center gap-1 font-semibold text-primary-fg hover:underline">
                  How {s.h.toLowerCase()} works <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              </div>
              <Shot src={page.shot.src} alt={page.shot.alt} />
            </Container>
          </section>
        );
      })}

      <section aria-labelledby="how-h" className="border-y border-line bg-panel py-20 md:py-28">
        <Container>
          <h2 id="how-h" className="text-[2rem] font-semibold tracking-[-0.02em] md:text-[2.5rem]">
            How it works
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-5">
            {FLOW.map((f, i) => (
              <li key={f.h} className="relative border-t-2 border-fg pt-4">
                <span className="font-mono text-sm text-muted">{i + 1}</span>
                <h3 className="mt-1 text-lg font-semibold">{f.h}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.p}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="facts-h" className="py-20 md:py-28">
        <Container>
          <h2 id="facts-h" className="text-[2rem] font-semibold tracking-[-0.02em] md:text-[2.5rem]">
            What the system does, in numbers
          </h2>
          <dl className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((c) => (
              <div key={c.label}>
                <dt className="sr-only">{c.label}</dt>
                <dd className="font-mono text-4xl font-semibold tabular tracking-[-0.02em]">{c.value}</dd>
                <dd className="mt-2 text-muted">{c.label}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-14 rounded-2xl border border-line bg-panel p-6 md:p-8">
            <h3 className="font-semibold">Illustrative pilot scenario</h3>
            <p className="mt-1 text-sm text-muted">Figures from the ClathraRefine demo plant scenario, not a customer result.</p>
            <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PILOT.map((m) => (
                <div key={m.label}>
                  <dt className="text-sm text-muted">{m.label}</dt>
                  <dd className="font-mono text-2xl font-semibold tabular">{m.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>

      <section aria-labelledby="ind-h" className="border-y border-line bg-panel py-20 md:py-28">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <h2 id="ind-h" className="text-[2rem] font-semibold tracking-[-0.02em] md:text-[2.5rem]">
            Built for plants that handle flammable gas every day
          </h2>
          <ul className="divide-y divide-line border-y border-line">
            {INDUSTRIES.map((ind) => (
              <li key={ind.slug}>
                <Link href={`/solutions/${ind.slug}`} className="group flex items-center justify-between gap-4 py-5">
                  <span>
                    <span className="block text-lg font-semibold">{ind.name}</span>
                    <span className="block text-sm text-muted">{ind.lead}</span>
                  </span>
                  <ArrowRight aria-hidden className="h-5 w-5 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="sec-h" className="py-20 md:py-28">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 id="sec-h" className="text-[2rem] font-semibold tracking-[-0.02em] md:text-[2.5rem]">
              The cloud can never override local safety
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">The controller accepts two commands from the cloud: SCRAM, which makes the plant safer, and ping. Nothing remote can clear a trip, silence a siren or change a threshold.</p>
            <Link href="/security" className="mt-6 inline-flex items-center gap-1 font-semibold text-primary-fg hover:underline">
              Read the security model <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
          <ul className="flex flex-col gap-4 text-lg">
            {["Local trips keep working when Wi-Fi or AWS is down", "About 2.3 hours of readings buffered on the device and uploaded later", "Overrides need a second, different supervisor and their PIN", "Every command, approval and payment in an append-only, hash-chained audit trail", "Device private keys never pass through the web app"].map((t) => (
              <li key={t} className="flex gap-3">
                <Check aria-hidden className="mt-1 h-5 w-5 shrink-0 text-ok-fg" /> {t}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="price-h" className="border-y border-line bg-panel py-20 md:py-24">
        <Container className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="price-h" className="text-[2rem] font-semibold tracking-[-0.02em] md:text-[2.5rem]">
              Start with one skid
            </h2>
            <p className="mt-3 max-w-xl text-lg text-muted">
              Plans from {formatMoney(TIERS[0].kobo!, "NGN")} a month for a pilot skid, {formatMoney(TIERS[1].kobo!, "NGN")} for a modular mini-refinery, and a custom service level for large complexes.
            </p>
          </div>
          <CtaLink href="/pricing" variant="secondary">
            See pricing <ArrowRight aria-hidden className="h-4 w-4" />
          </CtaLink>
        </Container>
      </section>

      <section aria-labelledby="cta-h" className="py-24 md:py-32">
        <Container className="text-center">
          <h2 id="cta-h" className="mx-auto max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] [text-wrap:balance]">
            Turn captured carbon into revenue.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">See the demo plant predict a leak, trip safely, capture the CO2 and list it for sale, in fifteen minutes.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <CtaLink href="/contact">Book a demo</CtaLink>
            <CtaLink href="/app" variant="secondary">
              Explore the live demo plant
            </CtaLink>
          </div>
        </Container>
      </section>
    </>
  );
}
