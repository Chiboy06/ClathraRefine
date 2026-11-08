import { ogImage, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "ClathraRefine: see gas hazards coming, stop leaks at the source";

export default function Image() {
  return ogImage("See gas hazards coming. Stop leaks at the source.");
}
