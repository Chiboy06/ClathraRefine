import { ogImage, OG_SIZE } from "@/lib/og";
import { INDUSTRIES } from "@/lib/siteContent";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "ClathraRefine for your industry";
export const generateStaticParams = () => INDUSTRIES.map((i) => ({ industry: i.slug }));

export default async function Image({ params }: { params: Promise<{ industry: string }> }) {
  const { industry } = await params;
  const i = INDUSTRIES.find((x) => x.slug === industry);
  return ogImage(`ClathraRefine for ${i?.name.toLowerCase() ?? "your industry"}`);
}
