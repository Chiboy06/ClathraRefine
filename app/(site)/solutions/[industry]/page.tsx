import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Container, CtaLink } from "@/components/site";
import { INDUSTRIES, PRODUCTS_PAGES } from "@/lib/siteContent";

export const dynamicParams = false;
export const generateStaticParams = () => INDUSTRIES.map((i) => ({ industry: i.slug }));

export async function generateMetadata({ params }: PageProps<"/solutions/[industry]">): Promise<Metadata> {
  const { industry } = await params;
  const i = INDUSTRIES.find((x) => x.slug === industry);
  return i ? { title: `ClathraRefine for ${i.name.toLowerCase()}`, description: `${i.lead} ${i.fit}`, alternates: { canonical: `/solutions/${i.slug}` } } : {};
}

export default async function Solution({ params }: PageProps<"/solutions/[industry]">) {
  const { industry } = await params;
  const ind = INDUSTRIES.find((x) => x.slug === industry);
  if (!ind) notFound();
  return (
    <>
      <section className="pb-12 pt-14 md:pt-20">
        <Container>
          <p className="text-sm text-muted">
            <Link href="/" className="hover:text-fg">Home</Link> / Solutions / {ind.name}
          </p>
          <h1 className="mt-4 max-w-4xl text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.03em] [text-wrap:balance]">ClathraRefine for {ind.name.toLowerCase()}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">{ind.lead}</p>
        </Container>
      </section>
      <section className="border-y border-line bg-panel py-16 md:py-20">
        <Container className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.015em]">The hazards</h2>
            <ul className="mt-6 flex flex-col gap-3 text-lg">
              {ind.hazards.map((h) => (
                <li key={h} className="flex gap-3"><AlertTriangle aria-hidden className="mt-1 h-5 w-5 shrink-0 text-warn-fg" /> {h}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.015em]">How ClathraRefine fits</h2>
            <p className="mt-6 text-lg leading-relaxed text-muted">{ind.fit}</p>
            <ul className="mt-6 flex flex-col gap-2">
              {PRODUCTS_PAGES.map((p) => (
                <li key={p.slug}>
                  <Link href={`/product/${p.slug}`} className="inline-flex items-center gap-1 font-semibold text-primary-fg hover:underline">
                    {p.name} <ArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>
      <section className="py-16 md:py-24">
        <Container className="flex flex-wrap items-center justify-between gap-6">
          <h2 className="text-2xl font-semibold tracking-[-0.015em]">See it on a plant like yours.</h2>
          <CtaLink href="/contact">Book a demo</CtaLink>
        </Container>
      </section>
    </>
  );
}
