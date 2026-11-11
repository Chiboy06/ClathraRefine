import { SsoCallback } from "@/components/authPanels";
import { clerkEnabled } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

// Clerk's provider is mounted only when Clerk keys are set, so render the callback only then.
export default function SSOCallbackPage() {
  return clerkEnabled() ? <SsoCallback /> : null;
}
