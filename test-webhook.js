const { Webhook } = require("svix");
const https = require("https");

const SECRET = "whsec_lZQj2hdwKm/bDhJMgyP+fa6xiL1PeaNP";
const URL = "https://clear-heron-393.eu-west-1.convex.site/clerk-webhook";

const body = JSON.stringify({
  type: "user.created",
  data: {
    id: "test_user_webhook_check",
    first_name: "Webhook",
    last_name: "Test",
    email_addresses: [{ id: "ea_1", email_address: "webhooktest@clathrarefine.test" }],
    primary_email_address_id: "ea_1",
    public_metadata: { role: "viewer" },
    created_at: Date.now(),
    updated_at: Date.now(),
  },
});

const wh = new Webhook(SECRET);
const msgId = "msg_test_" + Date.now();
const now = new Date();
const sig = wh.sign(msgId, now, body);
const ts = Math.floor(now.getTime() / 1000).toString();

const url = new globalThis.URL(URL);
const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "svix-id": msgId,
    "svix-timestamp": ts,
    "svix-signature": sig,
  },
};

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    console.log("Body:", data || "(empty)");
    if (res.statusCode === 200) {
      console.log("\n✅ Webhook is working correctly — user would be upserted in Convex.");
    } else {
      console.log("\n❌ Webhook failed. Check Convex dashboard logs.");
    }
  });
});
req.on("error", (e) => console.error("Request error:", e.message));
req.write(body);
req.end();
