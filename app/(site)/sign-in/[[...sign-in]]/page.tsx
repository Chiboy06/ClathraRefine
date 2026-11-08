import { Suspense } from "react";
import { ClerkSignIn, DemoQuickLogin } from "@/components/authPanels";
import { clerkEnabled, demoAuthEnabled } from "@/lib/server/auth";
import { DEMO_USERS } from "@/lib/demoData";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-6 py-16 md:py-24">
        <h1 className="text-center text-[2rem] font-semibold tracking-[-0.02em]">Sign in to ClathraRefine</h1>
        {clerkEnabled() ? (
          <>
            <ClerkSignIn />
            <div className="w-full rounded-lg border border-line bg-panel p-6 text-sm">
              <h2 className="mb-2 font-semibold">Demo accounts</h2>
              <p className="mb-2 text-muted">Passwords are held in Clerk, not in this app.</p>
              <ul className="grid grid-cols-1 gap-1 font-mono text-xs sm:grid-cols-2">
                {DEMO_USERS.map((u) => (
                  <li key={u.id}>
                    {u.role}: {u.email}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : demoAuthEnabled() ? (
          <div className="w-full rounded-lg border border-line bg-panel p-6">
            <h2 className="mb-1 font-semibold">Demo quick-login</h2>
            <p className="mb-4 text-sm text-muted">Clerk keys are not set, so this local build uses fixed demo users. One per role, plus a second supervisor for the two-person rule.</p>
            <Suspense>
              <DemoQuickLogin />
            </Suspense>
          </div>
        ) : (
          <Notice tone="warn">Sign-in is not configured. Set the Clerk keys, or DEMO_AUTH=true for a local demo.</Notice>
        )}
    </div>
  );
}
