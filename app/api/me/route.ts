import { getSession, clerkEnabled, demoAuthEnabled } from "@/lib/server/auth";
import { awsEnabled } from "@/lib/server/aws";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  return Response.json({
    session: s,
    auth: clerkEnabled() ? "clerk" : demoAuthEnabled() ? "demo" : "none",
    aws: awsEnabled(),
    paystack: !!process.env.PAYSTACK_SECRET_KEY,
  });
}
