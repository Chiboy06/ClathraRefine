import type { Metadata } from "next";
import { Container } from "@/components/site";
import { ContactForm } from "@/components/contactForm";

export const metadata: Metadata = {
  title: "Book a demo",
  description: "See ClathraRefine predict a gas leak, trip safely, capture the CO2 and list it for sale.",
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  return (
    <Container className="grid gap-12 py-14 md:py-20 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-tight tracking-[-0.03em]">Book a demo</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">In fifteen minutes we show a skid predicting a leak, the edge controller tripping, the scrubber capturing CO2 and a lot listed for sale. Then we talk about a pilot at your site.</p>
      </div>
      <div className="rounded-2xl border border-line bg-panel p-6 md:p-8">
        <ContactForm />
      </div>
    </Container>
  );
}
