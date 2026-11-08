import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site";
import { SITE } from "@/lib/siteContent";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: hazard prediction and gas leak prevention with carbon capture`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: { siteName: SITE.name, type: "website", locale: "en_GB" },
  twitter: { card: "summary_large_image" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE.url}#org`, name: SITE.name, url: SITE.url, logo: `${SITE.url}/icon.svg` },
    {
      "@type": "SoftwareApplication",
      name: SITE.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: SITE.description,
      publisher: { "@id": `${SITE.url}#org` },
      offers: { "@type": "Offer", price: "350000", priceCurrency: "NGN", description: "Academic/Pilot Skid, per month" },
    },
  ],
};

/** The marketing site is light by default; one section may switch to dark. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-theme="day" className="flex min-h-screen flex-col bg-canvas text-fg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-panel focus:p-2">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
