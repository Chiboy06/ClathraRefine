# Build report

**Design skills:** the two Apple skills from the brief's Notion page were installed from their GitHub repositories (`dickwu/apple-design-skill` as `apple-look`, `emilkowalski/skills` › `apple-design` as `apple-motion`), along with `impeccable` (copied from `pbakaus/impeccable` after review) and the existing `frontend-design`. All design work below follows their written guidance; see `docs/ASSUMPTIONS.md` item 23 for how they were installed.

Two passes are covered here:
1. **Build** of the full MVP from `docs/SCADA_BUILD_PROMPT.md`.
2. **Repositioning** from `docs/MODIFICATION_PROMPT.md`: ClathraRefine as hazard prediction and gas leak prevention with carbon capture, a marketing site, and the app moved under `/app`.

Route-by-route map: `docs/MODIFICATION_MAP.md`. Every decision made without an explicit answer: `docs/ASSUMPTIONS.md`.

## Routes before and after

| Before (build) | After (repositioning) |
| --- | --- |
| `/` landing | `/` home: prediction hero, problem, Predict, Prevent (dark), Capture, Recover value, how it works, capability facts, illustrative pilot, industries, security, pricing teaser, call to action |
| none | `/product/prediction`, `/product/prevention`, `/product/capture`, `/product/marketplace` |
| none | `/solutions/mini-refineries`, `/gas-processing`, `/lpg-depots`, `/chemical-plants`, `/boiler-houses` |
| `/pricing` (console) | `/pricing` (site) |
| none | `/security`, `/company`, `/contact`, `/resources` |
| `/sign-in`, `/sign-up` | same, restyled; sign-up lands on `/app/get-started` |
| `/dashboard` | `/app` (new story band on top) |
| `/fleet`, `/devices/[thing]` | `/app/fleet`, `/app/devices/[thing]` |
| none | `/app/predict` hazard prediction |
| `/measurements`, `/departments` | `/app/measurements`, `/app/departments` |
| none | `/app/capture` solvent, scrubber and capture lots |
| `/relays`, `/alarms`, `/events`, `/audit-log`, `/shift` | `/app/...` same names |
| `/marketplace`, `/marketplace/p/[id]`, `/orders`, `/rfq`, `/seller` | `/app/marketplace/...` |
| `/audits`, `/audit-history`, `/reports`, `/support`, `/admin` | `/app/...` same names |
| `/onboarding` | `/app/connect` ("Connect a device") |
| `/welcome` | `/app/organisation` |
| none | `/app/get-started` first-run stepper |
| none | 404, 500, `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, icons, Open Graph images |

Old paths redirect with 308 to the new ones.

## What each page does

### Marketing site (light, one dark section)
- **Home:** an animated SVG built from the scenario engine. The 30 s forecast reaches the trip threshold before the reading does, extraction starts, the forecast bends back down and "Prevented" appears. It pauses off-screen and shows a static final frame under reduced motion. Below it, four story sections, each with a real 2x screenshot of the app; capability facts (2 s readings, 30 s horizon, local trips, 2.3 h buffer); and the pilot metrics, labelled as an illustrative scenario. No customer logos, testimonials or invented claims.
- **Product pages:** a lead, a framed screenshot, sections, and "what it can and cannot do" for prediction.
- **Solutions:** the hazards for each industry and how ClathraRefine fits.
- **Pricing, security, company, contact, resources:** as listed in the brief. The contact form stores leads, with a honeypot field and a rate limit.
- **SEO:** a title and description on every page, a canonical URL, Organization and SoftwareApplication JSON-LD, Open Graph images, an authored SVG mark and app icons, a sitemap, and robots rules that exclude `/app` and `/api`.

### App (Day and Night themes, functional colours unchanged)
- **Shell:**
  - navigation grouped Overview, Predict, Prevent, Capture, Marketplace, Compliance, Support, Settings;
  - breadcrumbs, title, one-line purpose and primary action on every page;
  - command palette (Ctrl/Cmd+K) for pages, tags, devices and actions, including Trigger SCRAM;
  - notification centre for alarms, approvals, orders and tickets;
  - LIVE/DEMO badge with icons, link status, toggles, alarm banner, Master SCRAM, user menu, 30-minute idle sign-out.
- **Dashboard (`/app`):** a story band (risk and forecast, prevention state, carbon captured today, marketplace revenue this month) above all of the existing KPIs, the plant twin and the event log.
- **Hazard prediction (`/app/predict`):**
  - risk index with its trend;
  - forecast chart with thresholds and "Predicted crossing in N s" markers;
  - anomaly panel with the last 10 anomalies;
  - leading indicators;
  - a model card with the advisory statement.
  
  In DEMO the scenario look-ahead runs ahead of the alarm. In LIVE without `lib/model.json` there is an empty state with training steps.
- **Capture (`/app/capture`):** scrubber state, fan and pump, solvent loading, efficiency, today's captured mass, and capture lots with "Create listing" into the seller centre.
- **First run (`/app/get-started`):** organisation, first site, connect a device, then a live wait for the first reading and the dashboard. "Use demo plant" switches to DEMO and skips ahead.
- **Unchanged from the build:**
  - measurements and mass balance, departments, the relay deck, alarms with the ISA-18.2 state machine, events and audit trail, shift log;
  - marketplace with cart/RFQ drawer, proforma PDF, Paystack test checkout and webhook, orders, RFQs and the seller centre (now starting from capture lots, with "Captured at [site], [dates]" on each listing);
  - audit workspace with one-click diagnostic, S3 photo upload, lock and publish with PDF SHA-256; audit history with batch ZIP; reports; support desk; device; fleet; admin.
- **Safety:** SCRAM and the two-person modal are unchanged and reachable from the header and the palette.

## Tests

See "Results" below for the latest run.

- **Vitest:** process maths (91.96%, 184.2 kg/h, 0.55 g/L); unit and currency conversion; the alarm state machine; quality and staleness; the two-person rule; LTTB; the firmware port; the hash chain; cart pricing; the replay timeline; the hazard risk index; forecast crossing; leading indicators; model scoring.
- **Playwright:**
  - every site and app route in both themes and both data modes, with axe (no serious or critical findings), no horizontal scroll at 390 px, and screenshots at 390 and 1440 px in both themes (`docs/screenshots/after/`);
  - a viewer cannot SCRAM;
  - an operator SCRAM opens the modal and is audited;
  - a supervisor cannot approve their own override, and a second supervisor can;
  - add to cart, then proforma PDF, then Paystack checkout (redirects to Paystack when a test key is set; otherwise shows that the key is missing);
  - "Trigger leak" walks through warning, critical, SCRAM and recovery;
  - a bad webhook signature is refused, and prices never come from the browser;
  - old paths redirect;
  - signed-in visitors see "Open app";
  - the first-run flow and the "Use demo plant" path;
  - the prediction page in DEMO and in LIVE;
  - the command palette, including SCRAM;
  - the contact form.

## Results

(Filled in by the final verification run below.)

## Remodification

- **Navigation:** top tabs with left sub-menus, alarm counters by priority, a status bar with time, link, data mode and assistant state. Old routes redirect directly to their final home.
- **Removed:** the product, solutions, company, resources and security pages (redirect to `/`); the relay deck; the measurements page; certificate and Root CA downloads; two-person approval on relays and SCRAM.
- **SCRAM:** one action, hold 1 s or press then confirm within 4 s, for operators and above; audited.
- **Plant diagram:** a dark live mimic with values on the equipment, select-before-operate for the fan and pump (arm 10 s, confirm from telemetry within 15 s), manual and automatic modes, and the board's refusal reasons. A 3D view of the skid.
- **AI tab:** assistant (Gemini through Convex with tools, rule fallback, proactive alerts and a 15-minute briefing), predictions with a leak countdown and anomaly explainer, sensor health, solvent exhaustion forecast, training mode with decision points and scores. The assistant drafts the shift report.
- **Settings:** connect a device as six steps with a ping test and a first-data counter, and an ingest checklist that never shows `INGEST_KEY`; site details; sensors and MQ-135 calibration; users and roles; alarm limits and safety bypasses.
- **Firmware rev C:** MQ-135 inputs on GPIO4 and GPIO5, ACK button moved to GPIO12, `mode`, `fan` and `pump` commands with board interlocks, acks with a `reason`, telemetry adds `mode`, `co2_in_mv` and `co2_out_mv`. Compile not verified (see ASSUMPTIONS 41).
- **Ingest:** `/ingest` on Convex accepts the AWS destination confirmation, checks `x-ingest-key`, derives CO2 ppm and reduction. Live test: 200 for a good key, 401 for a missing or wrong key.

### Convex limits

Telemetry every 2 s, running all day, is about 1.3 million ingest calls a month (43,200 a day), before events, acks and dashboard queries. At the time of writing the Convex free plan allows about 1 million function calls a month, so one board at 2 s exceeds it. Recommendations:
- send telemetry every 5 s (about 518,000 calls a month) while on the free plan, keeping events immediate; or
- move to a paid plan before connecting more than one board at 2 s.

Check the current allowance in the Convex dashboard before deciding.
