"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { useMe } from "./me";
import { cx } from "./ui";
import { Mark } from "./mark";

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

const LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
  { href: "/app", label: "Console" },
];

/** Account links for menus and the footer: signed-in visitors get the console, never "Sign in". */
function useAccountLinks() {
  const { me } = useMe();
  return me?.session ? [{ href: "/app", label: "Open console" }] : [{ href: "/sign-in", label: "Sign in" }, { href: "/sign-up", label: "Sign up" }];
}

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
  const account = useAccountLinks();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-panel/85 backdrop-blur-md supports-[backdrop-filter]:bg-panel/75">
      <Container className="flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-[0.9375rem] font-semibold tracking-[-0.01em]">
          <Mark className="h-6 w-6" /> ClathraRefine
        </Link>
        <nav aria-label="Site" className="ml-4 hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3 py-2 text-sm hover:bg-elev">
              {l.label}
            </Link>
          ))}
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
            {[...LINKS, ...account].map((i) => (
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
  const account = useAccountLinks();
  const cols = [{ h: "ClathraRefine", links: [...LINKS, ...account] }];
  return (
    <footer className="border-t border-line bg-panel">
      <Container className="grid gap-10 py-14 md:grid-cols-[2fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Mark className="h-6 w-6" /> ClathraRefine
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted">Hazard prediction and gas leak prevention with carbon capture.</p>
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
      <Image src={src} alt={alt} width={2880} height={1800} priority={priority} sizes={priority ? "(min-width: 1152px) 1088px, 100vw" : "(min-width: 1024px) 560px, (min-width: 768px) 90vw, 100vw"} className="h-auto w-full" />
    </figure>
  );
}
