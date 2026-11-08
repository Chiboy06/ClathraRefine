import type { MetadataRoute } from "next";
import { INDUSTRIES, PRODUCTS_PAGES, SITE } from "@/lib/siteContent";

/** Public pages only; the app under /app is excluded from indexing. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/pricing", "/security", "/company", "/contact", "/resources", "/sign-up", ...PRODUCTS_PAGES.map((p) => `/product/${p.slug}`), ...INDUSTRIES.map((i) => `/solutions/${i.slug}`)];
  return paths.map((p) => ({ url: `${SITE.url}${p}`, changeFrequency: "monthly", priority: p === "/" ? 1 : 0.7 }));
}
