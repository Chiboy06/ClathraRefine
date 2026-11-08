import type { MetadataRoute } from "next";
import { SITE } from "@/lib/siteContent";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/app", "/api/", "/sign-in"] }, sitemap: `${SITE.url}/sitemap.xml` };
}
