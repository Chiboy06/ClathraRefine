import { cookies } from "next/headers";
import { z } from "zod";
import { demoAuthEnabled } from "@/lib/server/auth";
import { DEMO_USERS } from "@/lib/demoData";
import { parseBody } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

// Demo quick-login for local runs and tests only. Disabled whenever Clerk keys are set.
export async function POST(req: Request) {
  if (!demoAuthEnabled()) return new Response("Demo login is off", { status: 404 });
  const b = await parseBody(req, z.object({ userId: z.string() }));
  if (!b.ok) return b.res;
  const u = DEMO_USERS.find((d) => d.id === b.data.userId);
  if (!u) return new Response("Unknown demo user", { status: 400 });
  (await cookies()).set("demo_user", u.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  await audit({ userId: u.id, name: u.name, role: u.role }, "sign_in", "demo", "ok");
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete("demo_user");
  return Response.json({ ok: true });
}
