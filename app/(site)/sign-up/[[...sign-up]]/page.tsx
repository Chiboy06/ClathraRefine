import Link from "next/link";
import { ClerkSignUp } from "@/components/authPanels";
import { clerkEnabled } from "@/lib/server/auth";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign up", description: "Create a ClathraRefine account and connect your first site." };

export default function SignUpPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-6 py-16 md:py-24">
        <h1 className="text-center text-[2rem] font-semibold tracking-[-0.02em]">Create your ClathraRefine account</h1>
        <p className="text-center text-sm text-muted">New accounts start as viewer. After sign-up you set up your organisation and request a role; an admin approves upgrades.</p>
        {clerkEnabled() ? (
          <ClerkSignUp />
        ) : (
          <Notice tone="neutral">
            Sign-up runs through Clerk, which is not configured on this build. Use the{" "}
            <Link href="/sign-in" className="underline">
              demo quick-login
            </Link>
            , then open the organisation setup at <Link href="/app/organisation" className="underline">/welcome</Link>.
          </Notice>
        )}
    </div>
  );
}
