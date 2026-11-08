import type { Metadata } from "next";
import { Container, CtaLink } from "@/components/site";

export const metadata: Metadata = {
  title: "Company",
  description: "ClathraRefine builds hazard prediction and gas leak prevention with carbon capture for industrial plants.",
  alternates: { canonical: "/company" },
};

export default function Company() {
  return (
    <Container className="py-14 md:py-20">
      <h1 className="max-w-3xl text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-tight tracking-[-0.03em]">Make gas leaks something plants see coming</h1>
      <div className="mt-10 grid gap-12 md:grid-cols-2">
        <section aria-labelledby="mission-h">
          <h2 id="mission-h" className="text-2xl font-semibold tracking-[-0.015em]">
            Mission
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-muted">
            Industrial gas incidents start small: a weeping flange, a pump seal, a loading arm. We build systems that notice early, act on site without waiting for anyone, and capture what they remove instead of venting it, so safety and carbon reduction pay for each other.
          </p>
        </section>
        <section aria-labelledby="team-h">
          <h2 id="team-h" className="text-2xl font-semibold tracking-[-0.015em]">
            Team
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-muted">Team profiles are coming soon.</p>
        </section>
      </div>
      <section aria-labelledby="contact-h" className="mt-16 rounded-2xl border border-line bg-panel p-8">
        <h2 id="contact-h" className="text-2xl font-semibold tracking-[-0.015em]">
          Contact
        </h2>
        <p className="mt-3 text-lg text-muted">For demos, pilots and partnerships, use the contact form and we will reply by email.</p>
        <div className="mt-6">
          <CtaLink href="/contact">Book a demo</CtaLink>
        </div>
      </section>
    </Container>
  );
}
