import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { IngestAck, IngestTelemetry, classify, deriveTelemetry, isAwsEnableUrl, keyMatches } from "../lib/ingest";

const http = httpRouter();

/**
 * AWS IoT rule HTTPS action target. Telemetry, events and cmd/ack are posted here with header x-ingest-key.
 * Rule SQL: SELECT *, topic(2) AS device, topic() AS topic FROM 'clathrarefine/+/telemetry' (and /events, /cmd/ack).
 */
http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response("Body must be JSON", { status: 400 });
    }

    // AWS confirms an HTTPS destination once by posting a token and an enable URL.
    if (classify(body) === "confirm") {
      const url = String(body.enableUrl);
      if (!isAwsEnableUrl(url)) return new Response("Unexpected confirmation URL", { status: 400 });
      const r = await fetch(url);
      return new Response(null, { status: r.ok ? 200 : 502 });
    }

    if (!keyMatches(req.headers.get("x-ingest-key"), process.env.INGEST_KEY)) return new Response(null, { status: 401 });

    const now = Date.now();
    const kind = classify(body);
    if (kind === "ack") {
      const a = IngestAck.safeParse(body);
      if (!a.success) return new Response("Invalid ack", { status: 400 });
      const device = a.data.device ?? a.data.thing ?? "unknown";
      await ctx.runMutation(internal.store.event, { device, ingest_ms: now, kind: "ack", cmd: a.data.cmd, accepted: a.data.accepted, reason: a.data.reason });
      return new Response(null, { status: 200 });
    }

    const t = IngestTelemetry.safeParse(body);
    if (!t.success) return Response.json({ error: t.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
    const device = t.data.device ?? t.data.thing;
    if (kind === "event") {
      await ctx.runMutation(internal.store.event, {
        device,
        ingest_ms: now,
        kind: "event",
        ambient_level: t.data.ambient_level,
        scrubber: t.data.scrubber,
        trip_latched: t.data.trip_latched,
        scram: t.data.scram,
        mode: t.data.mode,
      });
      return new Response(null, { status: 200 });
    }
    const cal = await ctx.runQuery(internal.store.calibration, { device });
    const row = deriveTelemetry(t.data, now, cal);
    await ctx.runMutation(internal.store.telemetry, { row: pickTelemetry(row) });
    return new Response(null, { status: 200 });
  }),
});

/** Keep only schema fields; the rule may add extra columns such as sk, expires or topic. */
function pickTelemetry(r: ReturnType<typeof deriveTelemetry>) {
  return {
    device: r.device,
    ingest_ms: r.ingest_ms,
    ts: r.ts,
    uptime_ms: r.uptime_ms,
    exhaust_mv: r.exhaust_mv,
    ambient_mv: r.ambient_mv,
    ambient_level: r.ambient_level,
    scrubber: r.scrubber,
    relay_mask: r.relay_mask,
    trip_latched: r.trip_latched,
    siren_silenced: r.siren_silenced,
    warming_up: r.warming_up,
    scram: r.scram,
    sensor_fault: r.sensor_fault,
    buffered: r.buffered,
    fw: r.fw,
    mode: r.mode,
    co2_in_mv: r.co2_in_mv,
    co2_out_mv: r.co2_out_mv,
    gas_lpm: r.gas_lpm,
    liquid_lpm: r.liquid_lpm,
    solvent_c: r.solvent_c,
    ph: r.ph,
    co2_in_ppm: r.co2_in_ppm,
    co2_out_ppm: r.co2_out_ppm,
    reduction_pct: r.reduction_pct,
    capture_g_min: r.capture_g_min,
    quality: r.quality,
  };
}

export default http;
