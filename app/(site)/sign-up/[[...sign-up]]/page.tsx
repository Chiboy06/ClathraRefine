import { Suspense } from "react";
import Link from "next/link";
import { ClerkSignUp } from "@/components/authPanels";
import { clerkEnabled } from "@/lib/server/auth";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign up", description: "Create a ClathraRefine account and connect your first site." };

export default function SignUpPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16 md:py-24">
      {clerkEnabled() ? (
        <Suspense>
          <ClerkSignUp />
        </Suspense>
      ) : (
        <>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <Notice tone="neutral">
          Sign-up runs through Clerk, which is not configured on this build. Use the{" "}
          <Link href="/sign-in" className="underline">quick login</Link>.
        </Notice>
        </>
      )}
    </div>
  );
}
