import { ogImage, OG_SIZE } from "@/lib/og";
import { PRODUCTS_PAGES } from "@/lib/siteContent";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "ClathraRefine product page";
export const generateStaticParams = () => PRODUCTS_PAGES.map((p) => ({ slug: p.slug }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = PRODUCTS_PAGES.find((x) => x.slug === slug);
  return ogImage(p?.title ?? "ClathraRefine", `ClathraRefine ${p?.name ?? ""}`);
}
