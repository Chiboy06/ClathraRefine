import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "600", "700"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ClathraRefine", template: "%s | ClathraRefine" },
  description: "Industrial SCADA for modular mini-refineries with a B2B gas and by-product marketplace.",
};

// Sets the saved theme before first paint so Day users do not see a Night flash.
const themeScript = `try{var p=JSON.parse(localStorage.getItem("clathra-prefs")||"{}");document.documentElement.dataset.theme=(p.state&&p.state.theme)||"night"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  const body = (
    <html lang="en-GB" data-theme="night" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <ClerkProvider>{body}</ClerkProvider> : body;
}
