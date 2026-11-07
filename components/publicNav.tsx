import Link from "next/link";
import { Activity } from "lucide-react";

export function PublicHeader() {
  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-4 md:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <Activity aria-hidden className="h-5 w-5 text-fluid" /> ClathraRefine
        </Link>
        <nav aria-label="Public" className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <Link href="/marketplace" className="rounded-md px-3 py-2 hover:bg-elev">
            Marketplace
          </Link>
          <Link href="/pricing" className="rounded-md px-3 py-2 hover:bg-elev">
            Pricing
          </Link>
          <Link href="/sign-in" className="rounded-md px-3 py-2 hover:bg-elev">
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-md bg-primary px-3 py-2 font-semibold text-white hover:bg-primary/90">
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-panel">
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 text-sm text-muted md:grid-cols-3 md:px-8 lg:px-10">
        <div>
          <div className="font-bold text-fg">ClathraRefine</div>
          <p className="mt-2">Energenius Squad, University of Abuja. NSChE hackathon prototype, Port Harcourt, November 2026.</p>
        </div>
        <div>
          <div className="font-semibold text-fg">Honest limits</div>
          <p className="mt-2">The MQ-2 detects combustible gases and smoke, not CO2. CO2 figures are simulated. This is a prototype, not a certified safety system.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-1">
          <Link href="/dashboard" className="hover:text-fg">
            SCADA console
          </Link>
          <Link href="/marketplace" className="hover:text-fg">
            Gas marketplace
          </Link>
          <Link href="/pricing" className="hover:text-fg">
            Pricing
          </Link>
          <Link href="/support" className="hover:text-fg">
            Field support
          </Link>
        </nav>
      </div>
    </footer>
  );
}
