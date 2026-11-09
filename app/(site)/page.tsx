import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { Container, CtaLink, Shot } from "@/components/site";
import { HeroCurve } from "@/components/heroCurve";
import { CAPABILITIES, SITE } from "@/lib/siteContent";

export const metadata: Metadata = {
  title: { absolute: `${SITE.name}: see gas hazards coming, stop leaks at the source` },
  description: SITE.description,
  alternates: { canonical: "/" },
};

const STORY = [
  { id: "predict", h: "Predict", line: "Know a leak is coming 30 seconds before the alarm.", shot: { src: "/images/product/predict.png", alt: "Predictions page with a risk index and a 30 second forecast line crossing the trip threshold ahead of the reading" } },
  { id: "prevent", h: "Prevent", line: "The controller on site trips, sounds the siren and extracts in milliseconds, with or without the cloud.", shot: { src: "/images/product/alarms.png", alt: "Alarms page with active alarms by priority and the event journal" } },
  { id: "capture", h: "Capture", line: "Extracted gas goes through a solvent scrubber, not into the air.", shot: { src: "/images/product/plant.png", alt: "Live process diagram of the capture skid with inlet and outlet CO2, fan, pump and solvent tank" } },
  { id: "recover", h: "Recover value", line: "Sell what you capture, with the production data behind every lot.", shot: { src: "/images/product/marketplace.png", alt: "Marketplace catalogue with captured CO2 and by-product listings" } },
] as const;

const SAFETY = ["Local trips keep working when Wi-Fi or the cloud is down", "A trip resets only with the physical button on site", "Safety bypasses need a second supervisor and expire on their own", "Every command and approval lands in a hash-chained audit trail"];

export default function Home() {
  return (
    <>
      <section className="pb-16 pt-14 md:pb-24 md:pt-20">
        <Container>
          <h1 className="max-w-4xl text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.035em] [text-wrap:balance]">See gas hazards coming. Stop leaks at the source.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">Predict a gas hazard before the alarm, act on site in milliseconds, capture the CO2 and sell it.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaLink href="/contact">Book a demo</CtaLink>
            <CtaLink href="/app" variant="secondary">
              Explore the demo plant <ArrowRight aria-hidden className="h-4 w-4" />
            </CtaLink>
          </div>
          <div className="mt-12 rounded-3xl border border-line bg-panel p-4 md:p-8">
            <HeroCurve />
            <p className="mt-2 text-sm text-muted">Illustration from the demo scenario: the forecast reaches the trip line first, so extraction starts early.</p>
          </div>
        </Container>
      </section>

      {STORY.map((s, i) => (
        <section key={s.id} aria-labelledby={`${s.id}-h`} className={i % 2 ? "border-y border-line bg-panel py-16 md:py-24" : "py-16 md:py-24"}>
          <Container className={`grid items-center gap-10 lg:grid-cols-[1fr_1.6fr] ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
            <div>
              <h2 id={`${s.id}-h`} className="text-[2.25rem] font-semibold leading-tight tracking-[-0.025em] md:text-[2.75rem]">
                {s.h}
              </h2>
              <p className="mt-3 max-w-md text-xl leading-snug text-muted">{s.line}</p>
            </div>
            <Shot src={s.shot.src} alt={s.shot.alt} />
          </Container>
        </section>
      ))}

      <section aria-labelledby="facts-h" className="py-16 md:py-24">
        <Container>
          <h2 id="facts-h" className="text-[2rem] font-semibold tracking-[-0.02em] md:text-[2.5rem]">
            In numbers
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
        </Container>
      </section>

      <section aria-labelledby="sec-h" className="border-y border-line bg-panel py-16 md:py-24">
        <Container className="grid gap-10 lg:grid-cols-2">
          <h2 id="sec-h" className="text-[2rem] font-semibold tracking-[-0.02em] md:text-[2.5rem]">
            The cloud never overrides local safety
          </h2>
          <ul className="flex flex-col gap-4 text-lg">
            {SAFETY.map((t) => (
              <li key={t} className="flex gap-3">
                <Check aria-hidden className="mt-1 h-5 w-5 shrink-0 text-ok-fg" /> {t}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="cta-h" className="py-24 md:py-32">
        <Container className="text-center">
          <h2 id="cta-h" className="mx-auto max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] [text-wrap:balance]">
            Turn captured carbon into revenue.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <CtaLink href="/contact">Book a demo</CtaLink>
            <CtaLink href="/pricing" variant="secondary">
              See pricing
            </CtaLink>
          </div>
        </Container>
      </section>
    </>
  );
}
