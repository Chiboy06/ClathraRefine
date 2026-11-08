import Link from "next/link";
import { Mark } from "@/components/mark";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main id="main" data-theme="day" className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center text-fg">
      <Mark className="h-12 w-12" />
      <h1 className="mt-8 text-[clamp(2rem,5vw,3.5rem)] font-semibold tracking-[-0.03em]">This page is not here</h1>
      <p className="mt-4 max-w-md text-lg text-muted">The link may be old: app pages moved under /app. Try the home page or open the app.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-semibold text-white hover:bg-primary/90">
          Go to the home page
        </Link>
        <Link href="/app" className="inline-flex min-h-11 items-center rounded-full border border-line bg-panel px-5 font-semibold hover:bg-elev">
          Open the app
        </Link>
      </div>
    </main>
  );
}
