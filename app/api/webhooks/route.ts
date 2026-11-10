import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { ConvexHttpClient } from "convex/browser";
import { internal } from "@/convex/_generated/api";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

export async function POST(req: NextRequest) {
  // verifyWebhook reads CLERK_WEBHOOK_SIGNING_SECRET automatically
  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return new Response("Verification failed", { status: 400 });
  }

  if (evt.type !== "user.created" && evt.type !== "user.updated") {
    return new Response("OK", { status: 200 });
  }

  const d = evt.data;
  const clerkId = d.id;
  const name = [d.first_name, d.last_name].filter(Boolean).join(" ") || d.username || clerkId;
  const email = d.email_addresses?.find((e) => e.id === d.primary_email_address_id)?.email_address;
  const meta = d.public_metadata as { role?: string; orgId?: string } | undefined;
  const role = typeof meta?.role === "string" ? meta.role : "viewer";
  const orgId = typeof meta?.orgId === "string" ? meta.orgId : undefined;
  const createdAt = typeof d.created_at === "number" ? d.created_at : Date.now();
  const updatedAt = typeof d.updated_at === "number" ? d.updated_at : Date.now();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await convex.mutation(internal.users.upsert as any, { clerkId, name, email, role, orgId, createdAt, updatedAt });
  } catch (err) {
    console.error("Convex upsert failed:", err);
    // Return 500 so Svix retries
    return new Response("Database error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
