import bcrypt from "bcryptjs";
import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { ApproveBody } from "@/lib/schema/api";
import { get, put, update } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { approvalError, type OverrideRequest } from "@/lib/twoPerson";

export async function POST(req: Request, ctx: RouteContext<"/api/overrides/[id]/approve">) {
  // Tight limit: this is where a PIN could be guessed.
  const gate = await requirePerm("approve_override", { key: "approve", max: 5, windowMs: 60_000 });
  if (!gate.ok) return gate.res;
  const { id } = await ctx.params;
  const b = await parseBody(req, ApproveBody);
  if (!b.ok) return b.res;
  const s = gate.session;

  const hash = process.env.SUPERVISOR_PIN_HASH;
  if (!hash) return new Response("Supervisor PIN is not configured on the server", { status: 503 });
  if (!(await bcrypt.compare(b.data.pin, hash))) {
    await audit(s, "approve_override", id, "refused", "wrong PIN");
    return new Response("PIN not accepted", { status: 403 });
  }

  const reqItem = await get<OverrideRequest & Record<string, unknown>>("commands", id);
  const err = approvalError(reqItem, s.userId, s.role);
  // The store enforces the same rule as a condition, so a race cannot slip a self-approval through.
  const ok =
    !err &&
    (await update("commands", id, { status: "approved", approved_by: s.userId, approved_name: s.name, approved_at: Date.now() }, [
      { field: "status", eq: "pending" },
      { field: "requested_by", ne: s.userId },
    ]));
  if (!ok) {
    await audit(s, "approve_override", id, "refused", err ?? "condition failed");
    return new Response(err ?? "Needs a pending request and a different supervisor", { status: 409 });
  }

  const r = reqItem!;
  let outcome: "simulated" | "applied" | "requires_firmware" = "requires_firmware";
  if (r.kind === "setting") {
    await put("settings", { id: String(r.target), created_at: Date.now(), value: r.value, approved_by: s.userId, requested_by: r.requested_by });
    outcome = "applied";
  } else if (r.mode === "DEMO") outcome = "simulated";
  await audit(s, "approve_override", `${r.kind} ${r.target}=${r.value}`, "ok", `request ${id} by ${r.requested_name}, outcome ${outcome}`);
  return Response.json({ ok: true, outcome, request: { ...r, status: "approved", approved_by: s.userId, approved_name: s.name } });
}
