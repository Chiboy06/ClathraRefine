import { getSession, clerkEnabled, demoAuthEnabled } from "@/lib/server/auth";
import { awsEnabled } from "@/lib/server/aws";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  return Response.json({
    session: s,
    auth: clerkEnabled() ? "clerk" : demoAuthEnabled() ? "demo" : "none",
    aws: awsEnabled(),
    // Commands need both the OIDC role and the IoT data endpoint; neither value is sent to the browser.
    commands: awsEnabled() && !!process.env.IOT_ENDPOINT,
    paystack: !!process.env.PAYSTACK_SECRET_KEY,
  });
}
