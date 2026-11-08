import type { Metadata } from "next";
import { Container } from "@/components/site";
import { PricingTables } from "@/components/pricingTables";

export const metadata: Metadata = {
  title: "Pricing",
  description: "ClathraRefine plans for a pilot skid, a modular mini-refinery and large complexes, plus spot rates for captured CO2, biomethane, carbon tokens and recovered chemicals.",
  alternates: { canonical: "/pricing" },
};

export default function Pricing() {
  return (
    <Container className="py-14 md:py-20">
      <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-tight tracking-[-0.03em]">Pricing</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">One plan per site size. Prices are in naira; switch to dollars inside the app at the current exchange rate setting.</p>
      <div className="mt-12">
        <PricingTables />
      </div>
    </Container>
  );
}
