# ClathraRefine

ClathraRefine is an intelligent industrial hazard prediction and gas leakage prevention system with carbon capture. The story runs in this order everywhere: **Predict** (models read live gas sensor data and forecast a hazard before it crosses an alarm threshold: a 30 s forecast and an anomaly score), **Prevent** (the edge controller acts locally in milliseconds, with or without the cloud: staged alarms with hysteresis, a latched trip, the siren, SCRAM, extraction and scrubbing), **Capture** (extracted gas passes through a liquid-solvent scrubber that captures CO2; the app tracks capture efficiency, solvent loading and captured mass), **Recover value** (captured CO2 and by-products are sold to other companies on the platform, with the production data behind every lot). For operators and safety managers at mini-refineries, gas processing plants, LPG depots, chemical plants and boiler houses.

Read these before changing related code:
- `docs/SCADA_BUILD_PROMPT.md`: the full build brief. Every page in it ships.
- `docs/MODIFICATION_PROMPT.md`: the repositioning brief (marketing site, `/app` routes, prediction page). Route map in `docs/MODIFICATION_MAP.md`.
- `docs/ClathraRefine-guide.md`: hardware, firmware, AWS, dashboard API, models, marketplace, run book.

## System

- ESP32-S3-WROOM-1-N16R8, two MQ-2 sensors (exhaust GPIO1, ambient GPIO2, 10k/15k divider), ACK button GPIO4, six active-LOW relays GPIO6 to GPIO11 (1 fan, 2 pump, 3 red, 4 green, 5 yellow, 6 siren). Firmware: `firmware/ClathraRefine/ClathraRefine.ino` (Arduino-ESP32 core 3.x).
- AWS IoT Core in eu-west-1. Thing `ESP32S3-N16R8-HARNESS-01`. MQTT over TLS, port 8883, client ID = thing name.
- IoT rules store telemetry in DynamoDB `ClathraTelemetry` (PK `device`, SK `sk`, TTL `expires`) and events in `ClathraEvents`; raw copies in S3. Commands and overrides in `ClathraCommands` (PK `request_id`). Marketplace: `ClathraProducts`, `ClathraOrders`.
- Web app: Next.js (App Router, TypeScript, Tailwind) on Vercel, Clerk auth, AWS access through Vercel OIDC (`@vercel/oidc-aws-credentials-provider`), no stored AWS keys. Payments: Paystack test mode with seller subaccounts.

## Topics

- `clathrarefine/<thing>/telemetry` board, every 2 s
- `clathrarefine/<thing>/events` board, on a change
- `clathrarefine/<thing>/cmd` app to board: `{"cmd":"scram"}` or `{"cmd":"ping"}`
- `clathrarefine/<thing>/cmd/ack` board reply

Telemetry fields: `thing, ts (epoch ms, 0 if clock not set), uptime_ms, exhaust_mv, ambient_mv, ambient_level (NORMAL|WARNING|CRITICAL), scrubber (IDLE|INTAKE_ACTIVE|SCRUBBING|PURGING), relay_mask, trip_latched, siren_silenced, warming_up, scram, sensor_fault, buffered, fw`. The rule adds `device, sk, ingest_ms, expires`.

## Data modes

The app has two data modes, shown at all times in the header:
- **LIVE:** real readings from the board through AWS.
- **DEMO:** the full plant scenario from the build brief (inlet and outlet CO2, flows, revenue, departments, audits, products). Driven by a scenario engine and replayed recordings.

Every page works in both modes. A value that does not come from the board carries a small "Demo" or "Simulated" tag.

## Rules that must never be broken

1. The plant controller owns safety. The firmware accepts only `scram` and `ping`. Relay overrides, pulse tests and manual mode in the UI are recorded as requests; in DEMO mode they are simulated, and in LIVE mode they show "Requires firmware support" after approval instead of pretending to act.
2. A trip resets only with the physical ACK button once readings are NORMAL.
3. Models are advisory: they draw lines and raise notices, never actuate.
4. Never commit `secrets.h`, `.pem`/`.key` files or `.env*`. Never put a key, password or PIN in client code. The supervisor PIN for the two-person modal lives in a server environment variable (`SUPERVISOR_PIN_HASH`, bcrypt) and is checked on the server.
5. Roles are checked on the server (`lib/roles.ts`): viewer, operator, supervisor, auditor, buyer, seller, admin. Overrides need a second, different supervisor, enforced by a DynamoDB condition.
6. The MQ-2 does not measure CO2. CO2 %, ppm, efficiency and capture rate are DEMO or Simulated values and are tagged as such.
7. Marketplace listings are tagged Demo. Certifications on products are shown as "Target" standards, not claims. Prices come from the database, never the browser. An order is paid only after a verified Paystack webhook plus a verify call with a matching amount.
8. Device private keys never pass through the web app. The onboarding page may serve the public device certificate and Amazon Root CA only.

## Conventions

- UK English. No em dashes in user-facing text.
- Money stored in kobo as integers; NGN/USD toggle uses the exchange rate setting (default ₦1,450 per $1).
- Times stored in UTC epoch ms; shown with the `en-GB` locale and the zone visible.
- A reading below 100 mV means "check sensor", not clean air.

## Commands

- `npm run dev` (run `vercel env pull .env.local` first)
- `npm run build`, `npm run lint`, `npm test`, `npx playwright test` must all pass before a push
- Python training: `python train_models.py` (data from `aws s3 sync`)
