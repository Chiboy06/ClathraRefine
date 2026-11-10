import { Suspense } from "react";
import { ClerkSignIn, DemoQuickLogin } from "@/components/authPanels";
import { clerkEnabled, demoAuthEnabled } from "@/lib/server/auth";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16 md:py-24">
      {clerkEnabled() ? (
        <Suspense>
          <ClerkSignIn />
        </Suspense>
      ) : demoAuthEnabled() ? (
        <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8">
          <h2 className="mb-1 font-semibold">Quick login</h2>
          <p className="mb-4 text-sm text-muted">Select a role to explore the platform.</p>
          <Suspense>
            <DemoQuickLogin />
          </Suspense>
        </div>
      ) : (
        <Notice tone="warn">Sign-in is not configured. Set the Clerk keys, or DEMO_AUTH=true for a local build.</Notice>
      )}
    </div>
  );
}
