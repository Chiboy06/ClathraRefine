# ClathraRefine

ClathraRefine is a carbon capture skid with an industrial hazard monitoring and control console. The story runs in this order everywhere: **Predict** (a 30 s forecast and an anomaly score warn of a gas hazard before it crosses an alarm threshold), **Prevent** (the edge controller acts locally in milliseconds, with or without the cloud: staged alarms with hysteresis, a latched trip, the siren, SCRAM, extraction and scrubbing), **Capture** (extracted gas passes through a liquid-solvent scrubber; the app tracks inlet and outlet CO2, reduction, solvent loading and captured mass), **Recover value** (captured CO2 and by-products are sold to other companies on the platform, with the production data behind every lot). For operators and safety managers at mini-refineries, gas processing plants, LPG depots, chemical plants and boiler houses.

Read these before changing related code:
- `docs/REMODIFICATION_PROMPT.md`: the current brief (Convex, plant control, AI layer, navigation).
- `docs/SCADA_BUILD_PROMPT.md` and `docs/MODIFICATION_PROMPT.md`: earlier briefs. Where they conflict, the remodification brief wins.
- `docs/ClathraRefine-guide.md`: hardware, firmware, AWS, dashboard API, models, marketplace, run book.

## System

- **Board:** ESP32-S3-WROOM-1-N16R8. Firmware rev C: `firmware/ClathraRefine/ClathraRefine.ino` (Arduino-ESP32 core 3.x).
  - Two MQ-2 sensors: exhaust GPIO1, ambient GPIO2 (10k/15k divider).
  - Two MQ-135 CO2 sensors: inlet GPIO4, outlet GPIO5.
  - ACK button GPIO12 (moved from GPIO4 in rev C).
  - Six active-LOW relays GPIO6 to GPIO11 (1 fan, 2 pump, 3 red, 4 green, 5 yellow, 6 siren).
- **AWS IoT Core** in eu-west-1. Thing `ESP32S3-N16R8-HARNESS-01`. MQTT over TLS, port 8883, client ID = thing name. An IoT rule with an HTTPS action posts telemetry, events and `cmd/ack` to the Convex HTTP action `/ingest` with header `x-ingest-key`. The S3 archive rule stays for model training.
- **Convex** (`convex/`): telemetry, latest, events, hourly rollups, records and the assistant cache. Raw telemetry kept 30 days, rollups indefinitely (crons). Clerk JWT template `convex` carries the role; every public query checks it. The Next.js server reaches the records store with `CONVEX_SERVER_KEY`. DynamoDB stays only as a fallback store.
- **Web app:** Next.js (App Router, TypeScript, Tailwind) on Vercel, Clerk auth, AWS access through Vercel OIDC for publishing commands, no stored AWS keys. Payments: Paystack test mode with seller subaccounts.
- **AI assistant:** Gemini through a Convex action (`convex/assistant.ts`); the key is the Convex environment variable `GEMINI_API_KEY`. Tools run on the data on screen. Without the key, a rule-based fallback answers. No secrets or personal data in prompts.

## Topics

- `clathrarefine/<thing>/telemetry` board, every 2 s
- `clathrarefine/<thing>/events` board, on a change
- `clathrarefine/<thing>/cmd` app to board: `scram`, `ping`, `{"cmd":"mode","value":"manual|auto"}`, `{"cmd":"fan","value":"on|off"}`, `{"cmd":"pump","value":"on|off"}`
- `clathrarefine/<thing>/cmd/ack` board reply, with `accepted` and a `reason` when refused

Telemetry fields: `thing, ts (epoch ms, 0 if clock not set), uptime_ms, exhaust_mv, ambient_mv, ambient_level (NORMAL|WARNING|CRITICAL), scrubber (IDLE|INTAKE_ACTIVE|SCRUBBING|PURGING), relay_mask, trip_latched, siren_silenced, warming_up, scram, sensor_fault, buffered, fw, mode (AUTO|MANUAL), co2_in_mv, co2_out_mv`. Ingest adds `device`, the receive time and derived CO2 ppm from the MQ-135 calibration.

## Navigation

Top tabs, each with a left sub-menu (`components/nav.ts`): Overview, Monitoring, Plant (live mimic, 3D view), History, Alarms, AI (assistant, predictions, sensor health, solvent forecast, training), Marketplace, Settings (connect a device, site, sensors and calibration, users and roles, alarm limits), Maintenance. Old routes redirect in `next.config.ts`. The public site is only `/`, `/pricing`, `/contact`, `/sign-in`, `/sign-up`.

## Data modes

The app has two data modes, shown at all times in the header and status bar:
- **LIVE:** real readings from the board through AWS and Convex.
- **DEMO:** the full plant scenario (CO2, flows, solvent, revenue, departments, audits, products), driven by a scenario engine and replayed recordings.

Every page works in both modes. A value that does not come from the board carries a small "Demo" or "Simulated" tag.

## Rules that must never be broken

1. The plant controller owns safety. The firmware accepts only `scram`, `ping`, `mode`, `fan` and `pump`, and checks its own interlocks on every command (fan before pump, no manual mode while exhaust gas is active or a trip is latched; a hazard, trip, SCRAM, sensor fault or 10 minutes idle returns it to automatic). The app uses select-before-operate and shows the board's refusal reason. Safety bypasses that the firmware does not support show "Requires firmware support" in LIVE mode after approval.
2. A trip resets only with the physical ACK button once readings are NORMAL.
3. Models and the assistant are advisory: they draw lines, raise notices and explain. They never actuate, and the assistant cannot press SCRAM.
4. Never commit `secrets.h`, `.pem`/`.key` files or `.env*`. Never put a key, password or PIN in client code. Never display `INGEST_KEY`. The supervisor PIN lives in a server environment variable (`SUPERVISOR_PIN_HASH`, base64 of a bcrypt hash) and is checked on the server.
5. Roles are checked on the server (`lib/roles.ts`) and in Convex: viewer, operator, supervisor, auditor, buyer, seller, admin. Viewers cannot SCRAM or operate equipment. Two-person approval applies only to safety bypasses (siren mute, manual extension, with an expiry) and protected settings; the second supervisor must differ from the requester, enforced by a database condition.
6. CO2 shows as plain ppm and % on operator screens. The CO2 sensor model (MQ-135, low-cost) appears only in the device tree and Settings. Carbon tokens, certificates of analysis and exports keep their Demo and Target labels and never present MQ-135 readings as certified CO2 measurements.
7. Marketplace listings are tagged Demo. Certifications on products are shown as "Target" standards, not claims. Prices come from the database, never the browser. An order is paid only after a verified Paystack webhook plus a verify call with a matching amount.
8. Device private keys and certificates never pass through the web app. AWS provisioning is done in the AWS console.

## Conventions

- UK English. No em dashes in user-facing text. At most two sentences of explanation per card; the rest goes in a "?" help popover or the assistant.
- Money stored in kobo as integers; NGN/USD toggle uses the exchange rate setting (default ₦1,450 per $1).
- Times stored in UTC epoch ms; shown with the `en-GB` locale and the zone visible.
- A reading below 100 mV means "check sensor", not clean air.
- Commit messages carry no co-author or AI attribution trailer.

## Commands

- `npm run dev` (run `vercel env pull .env.local` first); `npx convex dev` for the Convex functions
- `npm run build`, `npm run lint`, `npm test`, `npx playwright test` must all pass before a push
- Python training: `python train_models.py` (data from `aws s3 sync`)
- Product screenshots: `node scripts/product-shots.mjs` against a running server with `DEMO_AUTH=true`
