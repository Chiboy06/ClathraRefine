import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";
import { Container, CtaLink, Shot } from "@/components/site";
import { PRODUCTS_PAGES } from "@/lib/siteContent";

export const dynamicParams = false;
export const generateStaticParams = () => PRODUCTS_PAGES.map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = PRODUCTS_PAGES.find((x) => x.slug === slug);
  return p ? { title: `${p.name}: ${p.title}`, description: p.lead, alternates: { canonical: `/product/${p.slug}` } } : {};
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const p = PRODUCTS_PAGES.find((x) => x.slug === slug);
  if (!p) notFound();
  const i = PRODUCTS_PAGES.indexOf(p);
  const next = PRODUCTS_PAGES[(i + 1) % PRODUCTS_PAGES.length];
  return (
    <>
      <section className="pb-12 pt-14 md:pt-20">
        <Container>
          <p className="text-sm text-muted">
            <Link href="/" className="hover:text-fg">Home</Link> / {p.name}
          </p>
          <h1 className="mt-4 max-w-4xl text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.03em] [text-wrap:balance]">{p.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">{p.lead}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaLink href="/contact">Book a demo</CtaLink>
            <CtaLink href="/app" variant="secondary">Try it on the demo plant</CtaLink>
          </div>
          <div className="mt-12">
            <Shot src={p.shot.src} alt={p.shot.alt} priority />
          </div>
        </Container>
      </section>
      <section className="py-16 md:py-24">
        <Container className="grid gap-12 md:grid-cols-2">
          {p.sections.map((s) => (
            <div key={s.h}>
              <h2 className="text-2xl font-semibold tracking-[-0.015em]">{s.h}</h2>
              <p className="mt-3 text-lg leading-relaxed text-muted">{s.p}</p>
              {s.points && (
                <ul className="mt-4 flex flex-col gap-2">
                  {s.points.map((pt) => (
                    <li key={pt} className="flex gap-2">
                      <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-ok-fg" /> {pt}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Container>
      </section>
      {p.limits && (
        <section aria-labelledby="limits-h" className="border-y border-line bg-panel py-16 md:py-20">
          <Container>
            <h2 id="limits-h" className="text-2xl font-semibold tracking-[-0.015em]">What it can and cannot do</h2>
            <div className="mt-8 grid gap-10 md:grid-cols-2">
              <ul className="flex flex-col gap-3">
                {p.limits.can.map((c) => (
                  <li key={c} className="flex gap-2"><Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-ok-fg" /> {c}</li>
                ))}
              </ul>
              <ul className="flex flex-col gap-3">
                {p.limits.cannot.map((c) => (
                  <li key={c} className="flex gap-2"><X aria-hidden className="mt-1 h-4 w-4 shrink-0 text-crit-fg" /> {c}</li>
                ))}
              </ul>
            </div>
          </Container>
        </section>
      )}
      <section className="py-16 md:py-20">
        <Container>
          <Link href={`/product/${next.slug}`} className="group inline-flex items-center gap-2 text-2xl font-semibold tracking-[-0.015em]">
            Next: {next.name} <ArrowRight aria-hidden className="h-6 w-6 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </Container>
      </section>
    </>
  );
}
