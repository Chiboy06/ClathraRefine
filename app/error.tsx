"use client";
import Link from "next/link";
import { Mark } from "@/components/mark";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" data-theme="day" className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center text-fg">
      <Mark className="h-12 w-12" />
      <h1 className="mt-8 text-[clamp(2rem,5vw,3.5rem)] font-semibold tracking-[-0.03em]">Something went wrong on our side</h1>
      <p className="mt-4 max-w-md text-lg text-muted">Plant safety is not affected: the edge controller runs on site without this page. Try again, or go back to the home page.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-semibold text-white hover:bg-primary/90">
          Try again
        </button>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-line bg-panel px-5 font-semibold hover:bg-elev">
          Go to the home page
        </Link>
      </div>
    </main>
  );
}
