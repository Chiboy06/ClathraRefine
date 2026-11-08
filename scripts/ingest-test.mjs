// Live ingest check against the Convex deployment: node --env-file=.env.local scripts/ingest-test.mjs
// Posts one sample telemetry row with the key (expect 200, then stored) and without it (expect 401).
const site = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
const key = process.env.INGEST_KEY;
if (!site || !key) throw new Error("Set NEXT_PUBLIC_CONVEX_SITE_URL and INGEST_KEY");

const device = `INGEST-TEST-${Date.now()}`;
const sample = {
  thing: device, device, topic: `clathrarefine/${device}/telemetry`, ts: Date.now(), uptime_ms: 250000, exhaust_mv: 3600, ambient_mv: 480,
  ambient_level: "NORMAL", scrubber: "SCRUBBING", relay_mask: 11, trip_latched: false, siren_silenced: false, warming_up: false,
  scram: false, sensor_fault: false, buffered: false, fw: "rev-C", mode: "AUTO", co2_in_mv: 1880, co2_out_mv: 980, gas_lpm: 1,
};
const post = (headers) => fetch(`${site}/ingest`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(sample) });

const withKey = await post({ "x-ingest-key": key });
const noKey = await post({});
const badKey = await post({ "x-ingest-key": "wrong" });
console.log("with key:", withKey.status, "| no key:", noKey.status, "| wrong key:", badKey.status);

// Check the stored row with: npx convex data latest --limit 3
const ok = withKey.status === 200 && noKey.status === 401 && badKey.status === 401;
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
