import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/convexProvider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "600", "700"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ClathraRefine", template: "%s | ClathraRefine" },
  description: "Smart gas-leak prediction and prevention with carbon capture.",
};

// Sets the saved theme before first paint so Day users do not see a Night flash.
const themeScript = `try{var p=JSON.parse(localStorage.getItem("clathra-prefs")||"{}");document.documentElement.dataset.theme=(p.state&&p.state.theme)||"day"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  const clerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    <html lang="en-GB" data-theme="day" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        {clerk ? (
          <ClerkProvider>
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
