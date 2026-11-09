import type { MetadataRoute } from "next";
import { SITE } from "@/lib/siteContent";

/** Public pages only; the app under /app is excluded from indexing. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/pricing", "/contact", "/sign-in", "/sign-up"];
  return paths.map((p) => ({ url: `${SITE.url}${p}`, changeFrequency: "monthly", priority: p === "/" ? 1 : 0.7 }));
}
