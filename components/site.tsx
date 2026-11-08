"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { useMe } from "./me";
import { cx } from "./ui";
import { Mark } from "./mark";
import { INDUSTRIES, PRODUCTS_PAGES } from "@/lib/siteContent";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-6xl px-6 md:px-8", className)}>{children}</div>;
}

export function CtaLink({ href, children, variant = "primary", testId }: { href: string; children: ReactNode; variant?: "primary" | "secondary"; testId?: string }) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[0.9375rem] font-semibold transition-colors duration-150",
        variant === "primary" ? "bg-primary text-white hover:bg-primary/90" : "border border-line bg-panel text-fg hover:bg-elev",
      )}
    >
      {children}
    </Link>
  );
}

function Menu_({ label, items }: { label: string; items: { href: string; label: string; hint: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button onClick={() => setOpen((o) => !o)} onMouseEnter={() => setOpen(true)} aria-expanded={open} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm hover:bg-elev">
        {label} <ChevronDown aria-hidden className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 w-72 pt-2">
          <ul className="rounded-2xl border border-line bg-panel p-2 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.25)]">
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 hover:bg-elev">
                  <span className="block text-sm font-semibold">{i.label}</span>
                  <span className="block text-xs text-muted">{i.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const PRODUCT_ITEMS = PRODUCTS_PAGES.map((p) => ({ href: `/product/${p.slug}`, label: p.name, hint: p.title }));
const SOLUTION_ITEMS = INDUSTRIES.map((i) => ({ href: `/solutions/${i.slug}`, label: i.name, hint: i.lead }));

/** Signed-in visitors see "Open app" instead of "Sign in". */
function AccountLinks() {
  const { me } = useMe();
  if (me?.session)
    return (
      <CtaLink href="/app" testId="open-app">
        Open app
      </CtaLink>
    );
  return (
    <>
      <Link href="/sign-in" className="hidden rounded-full px-3 py-2 text-sm hover:bg-elev sm:inline-flex">
        Sign in
      </Link>
      <CtaLink href="/contact">Book a demo</CtaLink>
    </>
  );
}

export function SiteHeader() {
  const [mobile, setMobile] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-panel/85 backdrop-blur-md supports-[backdrop-filter]:bg-panel/75">
      <Container className="flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-[0.9375rem] font-semibold tracking-[-0.01em]">
          <Mark className="h-6 w-6" /> ClathraRefine
        </Link>
        <nav aria-label="Site" className="ml-4 hidden items-center gap-1 lg:flex">
          <Menu_ label="Product" items={PRODUCT_ITEMS} />
          <Menu_ label="Solutions" items={SOLUTION_ITEMS} />
          <Link href="/pricing" className="rounded-full px-3 py-2 text-sm hover:bg-elev">
            Pricing
          </Link>
          <Link href="/security" className="rounded-full px-3 py-2 text-sm hover:bg-elev">
            Security
          </Link>
          <Link href="/resources" className="rounded-full px-3 py-2 text-sm hover:bg-elev">
            Resources
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <AccountLinks />
          <button onClick={() => setMobile((m) => !m)} aria-expanded={mobile} aria-label={mobile ? "Close menu" : "Open menu"} className="rounded-full p-2 hover:bg-elev lg:hidden">
            {mobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </Container>
      {mobile && (
        <nav aria-label="Site mobile" className="border-t border-line bg-panel lg:hidden">
          <Container className="grid grid-cols-2 gap-x-6 gap-y-1 py-4 text-sm">
            {[...PRODUCT_ITEMS, ...SOLUTION_ITEMS, { href: "/pricing", label: "Pricing" }, { href: "/security", label: "Security" }, { href: "/resources", label: "Resources" }, { href: "/company", label: "Company" }, { href: "/sign-in", label: "Sign in" }].map((i) => (
              <Link key={i.href} href={i.href} onClick={() => setMobile(false)} className="rounded-lg px-2 py-2 hover:bg-elev">
                {i.label}
              </Link>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const cols: { h: string; links: { href: string; label: string }[] }[] = [
    { h: "Product", links: PRODUCT_ITEMS.map(({ href, label }) => ({ href, label })) },
    { h: "Solutions", links: SOLUTION_ITEMS.map(({ href, label }) => ({ href, label })) },
    { h: "Company", links: [{ href: "/company", label: "About" }, { href: "/security", label: "Security" }, { href: "/pricing", label: "Pricing" }, { href: "/resources", label: "Resources" }, { href: "/contact", label: "Contact" }] },
  ];
  return (
    <footer className="border-t border-line bg-panel">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Mark className="h-6 w-6" /> ClathraRefine
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted">Hazard prediction and gas leak prevention with carbon capture.</p>
          <p className="mt-6 max-w-xs text-xs text-muted">The MQ-2 class sensors used today detect combustible gases and smoke, not CO2. CO2 figures in the product are simulated until an infrared CO2 analyser is fitted, and are labelled that way.</p>
        </div>
        {cols.map((c) => (
          <nav key={c.h} aria-label={c.h}>
            <h2 className="text-sm font-semibold">{c.h}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-fg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <Container className="border-t border-line py-6 text-xs text-muted">© {new Date().getUTCFullYear()} ClathraRefine</Container>
    </footer>
  );
}

/** Product screenshot, framed like a window, at 2x. */
export function Shot({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_24px_48px_-24px_rgba(15,23,42,0.35)]">
      <div className="flex h-8 items-center gap-1.5 border-b border-line bg-elev px-3" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- static 2x screenshots, sized by width/height to avoid layout shift */}
      <img src={src} alt={alt} width={1440} height={900} loading={priority ? "eager" : "lazy"} decoding="async" className="h-auto w-full" />
    </figure>
  );
}
