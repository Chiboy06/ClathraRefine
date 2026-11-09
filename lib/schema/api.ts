import { z } from "zod";
import { ROLES } from "../roleMatrix";

const text = (max = 2000) => z.string().trim().min(1).max(max);

export const DataMode = z.enum(["LIVE", "DEMO"]);

export const ScramBody = z.object({ mode: DataMode, confirm: z.literal(true) });
export const PingBody = z.object({ mode: DataMode });

// Two-person approval covers safety bypasses and protected settings only. Bypasses expire automatically.
export const OverrideKind = z.enum(["siren_mute", "manual_extend", "setting"]);
export const SETTINGS = ["display_warn_mv", "display_crit_mv", "usd_ngn_rate"] as const;

export const OverrideBody = z
  .object({
    kind: OverrideKind,
    target: text(40), // "siren", "manual", or a setting name
    value: z.number().finite(),
    reason: text(500),
    mode: DataMode,
    confirm: z.literal(true),
  })
  .refine((b) => b.kind !== "setting" || (SETTINGS as readonly string[]).includes(b.target), { message: "Unknown setting" })
  .refine((b) => b.kind === "setting" || (Number.isInteger(b.value) && b.value >= 1 && b.value <= 60), { message: "Bypass expiry must be 1 to 60 minutes" })
  .refine((b) => b.target !== "usd_ngn_rate" || (b.value >= 100 && b.value <= 10_000), { message: "Rate out of range" });

export const ApproveBody = z.object({ pin: z.string().min(4).max(12).regex(/^\d+$/), confirm: z.literal(true) });

export const AlarmActionBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ack"), alarm_id: text(80) }),
  z.object({ action: z.literal("shelve"), alarm_id: text(80), reason: text(300), until: z.number().int().positive() }),
]);

export const TicketBody = z.object({
  category: z.enum(["Sensor", "Relay", "Network", "Solvent / chemical", "Marketplace", "Other"]),
  severity: z.enum(["Low", "Medium", "High", "Critical"]),
  description: text(4000),
  snapshot_csv: z.string().max(200_000).optional(),
});

export const ShiftBody = z.object({ shift: text(40), note: text(2000), handover: z.boolean() });
export const ShiftAcceptBody = z.object({ id: text(80) });

export const SiteBody = z.object({
  facility: text(120),
  station: text(60),
  region: z.enum(["eu-west-1", "eu-central-1", "us-east-1", "af-south-1"]),
  endpoint: z.string().trim().max(200).regex(/^$|^[a-z0-9-]+-ats\.iot\.[a-z0-9-]+\.amazonaws\.com$/, "Expected xxxx-ats.iot.<region>.amazonaws.com"),
  thing: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9:_-]+$/),
  topic: text(200),
});

export const OrgBody = z.object({
  company: text(120),
  org_type: z.enum(["plant operator", "buyer", "seller", "auditor"]),
  site: text(120),
  requested_role: z.enum(ROLES),
});

export const RoleChangeBody = z.object({ userId: text(80), role: z.enum(ROLES), request_id: z.string().optional() });

export const CartLineSchema = z.object({ productId: text(80), packagingId: text(40), qty: z.number().int().positive().max(10_000) });
export const CartBody = z.object({
  lines: z.array(CartLineSchema).min(1).max(20),
  logistics: z.enum(["pickup", "tanker"]),
  location: text(80),
});
export const RfqBody = CartBody.extend({ note: z.string().max(1000).optional() });

export const ListingBody = z.object({
  title: text(160),
  category: text(60),
  description: text(1000),
  packaging_label: text(80),
  price_kobo: z.number().int().positive().max(10_000_000_000),
  moq: z.number().int().positive().max(10_000),
  stock: z.number().int().nonnegative().max(1_000_000),
  lot_id: text(60),
});

export const OrderStatusBody = z.object({ status: z.enum(["processing", "shipped", "delivered", "cancelled"]) });

export const AuditDraftBody = z.object({
  id: text(40),
  solvent_ph: z.number().min(0).max(14),
  flange_result: z.enum(["Pass", "Minor leak", "Fail"]),
  notes: z.string().max(4000),
  photos: z.array(z.object({ key: z.string().max(300), name: z.string().max(200) })).max(20),
  signature: z.string().max(200),
  diagnostics: z.array(z.object({ name: z.string(), value: z.string(), pass: z.boolean() })).max(20),
});

export const UploadBody = z.object({ name: text(200), type: z.enum(["image/jpeg", "image/png", "image/tiff"]), size: z.number().int().positive().max(15_000_000) });

/** Manual fan/pump/mode commands. The board applies its own interlocks and answers on cmd/ack. */
export const CommandBody = z.discriminatedUnion("cmd", [
  z.object({ cmd: z.literal("mode"), value: z.enum(["manual", "auto"]), mode: DataMode }),
  z.object({ cmd: z.literal("fan"), value: z.enum(["on", "off"]), mode: DataMode }),
  z.object({ cmd: z.literal("pump"), value: z.enum(["on", "off"]), mode: DataMode }),
]);
