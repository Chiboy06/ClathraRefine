import type { Metadata } from "next";
import { Shell } from "@/components/shell";

export const metadata: Metadata = { title: { default: "App", template: "%s | ClathraRefine" }, robots: { index: false, follow: false } };

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return <Shell>{children}</Shell>;
}
