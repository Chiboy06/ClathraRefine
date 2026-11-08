import { z } from "zod";
import { parseBody } from "@/lib/server/http";
import { newId, put } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rateLimit";

const ContactBody = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  company: z.string().trim().min(1).max(160),
  industry: z.enum(["Mini-refinery", "Gas processing", "LPG depot", "Chemical plant", "Boiler house", "Other"]),
  message: z.string().trim().max(2000).optional().default(""),
  website: z.string().max(0).optional(), // honeypot: real visitors leave it empty
});

/** "Book a demo" leads. Public, so rate limited per client address. */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!rateLimit(`contact:${ip}`, 5, 10 * 60_000)) return new Response("Too many requests, try again later", { status: 429 });
  const b = await parseBody(req, ContactBody);
  if (!b.ok) return b.res;
  const at = Date.now();
  const lead = { ...b.data, website: undefined };
  await put("leads", { id: newId(at), created_at: at, ...lead, status: "new" });
  // shortcut: confirmation email is a placeholder; wire an email provider (for example Amazon SES) to send it.
  return Response.json({ ok: true });
}
