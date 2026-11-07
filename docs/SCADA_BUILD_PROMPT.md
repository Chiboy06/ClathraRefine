# ClathraRefine: complete MVP build brief for Claude Code

Save as `docs/SCADA_BUILD_PROMPT.md`. Start Claude Code in the repo and say:

> Read CLAUDE.md, docs/ClathraRefine-guide.md and docs/SCADA_BUILD_PROMPT.md. Build everything in the brief in one continuous run.

---

## 0. How to run this build

You are a Principal UI/UX architect and lead Next.js engineer building an enterprise SCADA platform with a B2B gas and by-product marketplace. Build the **complete MVP described here in one continuous run**.

- **Do not stop between sections and do not ask for approval.** Where something is unclear, make the most reasonable choice, record it in `docs/ASSUMPTIONS.md`, and keep going.
- **Ship every page in section 6.** Do not cut, merge away or postpone any page, feature, card, table, modal, drawer or button listed here.
- **Audit the existing v0 code first** (10 minutes at most). Reuse every component that fits, then extend.
- Keep a task list of all pages and features. Tick each item off as you finish it.
- After every few pages, run `npm run build` and fix errors before continuing. Commit after each completed area with a clear message.
- At the end, run the full verification in section 10, fix what fails, and write `docs/BUILD_REPORT.md`:
  - what was built, page by page;
  - test results;
  - known gaps;
  - every assumption.

Install and use these skills for UI work. impeccable's Operate mode applies to console pages, and Persuade mode to the landing, pricing and marketplace home pages.

```bash
npx skills add pbakaus/impeccable
npx skills add anthropics/skills@frontend-design
npx skills add vercel-labs/agent-skills@react-best-practices
```

Where this brief sets a colour, font, number or label, the brief wins over any skill's default.

---

## 1. Product

**ClathraRefine** is an enterprise SCADA platform for modular mini-refineries and process plants:
- flue gas sweetening and carbon capture;
- edge safety on ESP32-S3 controllers;
- a **B2B gas and by-product marketplace**, where recovered materials (liquid CO2, biomethane, carbon offsets, sodium carbonate solution) are sold to other companies on the same platform.

Each listing links to the production data that made it. That proof of origin is the platform's edge.

The pitch shows the full product. Every page is fully built and interactive.

## 2. Data modes: one app, live and demo

Build a global data layer with two modes, switchable from the header and always visible as a badge:

- **LIVE:** real data from the ESP32-S3 through AWS:
  - exhaust and ambient MQ-2 millivolts;
  - alarm level;
  - scrubber state;
  - relay mask;
  - trip, siren silenced, warm-up, SCRAM and sensor fault flags;
  - buffered readings.

  It uses the API routes in guide section 6.
- **DEMO:** a scenario engine generating the full plant with realistic, slowly varying values:
  - all brief figures (inlet 11.2% Vol, outlet 0.9% Vol, 91.96% efficiency, 184.2 kg/h, 450 m3/h, departments, revenue);
  - alarms and events on a believable timeline;
  - a "Trigger leak" control that plays a hazard sequence through warning, critical trip, SCRAM and recovery.

Rules:
- Pages read through one interface, `TelemetrySource`, with three implementations:
  - `ScenarioSource` (DEMO);
  - `ReplaySource` (plays `fixtures/recordings/*.json` from the S3 archive);
  - `ApiPollingSource` (LIVE).

  Add a stub `StreamSource` for a later WebSocket feed.
- In LIVE mode, MQ-2 readings come from the board. Plant-scale values with no sensor (CO2, flow, pressure, temperature, revenue) stay on the DEMO scenario and carry a small "Simulated" tag.
- Every value has a quality: Good, Uncertain (warm-up or buffered), Bad (sensor fault or below 100 mV) or Stale (no update for 10 s). Poor quality is always visible next to the value.

## 3. Global state and hardware logic

1. **Header toggles, persisted per user:**
   - concentration unit: `Vol %` / `PPM`;
   - currency: `₦ NGN` / `$ USD` at ₦1,450 per $1.00. The rate is an admin setting, and changing it needs two-person approval.
   - theme: Night (dark) / Day (light);
   - data mode: LIVE / DEMO.
2. **Sensor telemetry (ESP32-S3 ADC1):**

   | Sensor | Values |
   | --- | --- |
   | Exhaust inlet sensor (GPIO 1) | 11.2% Vol (112,000 PPM), 3,058 ADC in DEMO; real mV in LIVE |
   | Clean outlet sensor, post-scrubber | 0.9% Vol (9,000 PPM), 245 ADC (DEMO) |
   | Ambient safety sensor (GPIO 2) | 410 ADC baseline in DEMO; real mV in LIVE |

   Show ADC counts and millivolts side by side. The firmware works in sensor-side millivolts.
3. **Chemical calculations**, in one tested module `lib/process.ts`:
   - Removal efficiency: η = (C_in − C_out) / C_in × 100% (about 91.96% for the demo values).
   - CO2 capture rate: ṁ = (P × Q_gas / (R × T)) × (y_in − y_out) × M_CO2.
     - Make P, Q, T and the inputs parameters.
     - The demo shows "184.2 kg/hr CO2 Captured".
     - Display the formula with the live numbers substituted in.
   - Solvent capacity from guide 7.6: 0.025 M NaOH gives about 0.55 g CO2 per litre to carbonate. Use it for the solvent loading gauge.
4. **Six hardware relays (active-LOW):**

   | Relay | Load | Behaviour |
   | --- | --- | --- |
   | 1 (GPIO 6) | Air intake fan | |
   | 2 (GPIO 7) | CO2 liquid pump | 2.0 s staggered start, 5.0 s purge |
   | 3 (GPIO 8) | Red hazard strobe | |
   | 4 (GPIO 9) | Green normal lamp | |
   | 5 (GPIO 10) | Yellow pre-hazard lamp | |
   | 6 (GPIO 11) | Siren horn, 110 dB | |

   State comes from `relay_mask`, or from the scenario in DEMO mode.
5. **Two-person verification safety lockout.** Any manual override or Master SCRAM opens the supervisor modal:
   - initiator details;
   - the consequence warning;
   - the supervisor PIN field;
   - a confirmation checkbox;
   - the "Authorize Override" button.

   Verification is enforced on the server:
   - The PIN is checked against `SUPERVISOR_PIN_HASH` (bcrypt) in a server action.
   - The approving supervisor must be a different signed-in user from the initiator.
   - Both are written to the audit log.
   - For the demo, set the environment variable to the hash of the PIN you choose. The PIN never appears in client code.
   - SCRAM in LIVE mode publishes `{"cmd":"scram"}` and confirms from telemetry.
   - Relay overrides in LIVE mode show "Approved: requires firmware support" (the firmware accepts SCRAM only). In DEMO mode they act on the scenario.
6. **Cart and RFQ state:**
   - selected items, quantities and packaging;
   - delivery location and logistics option;
   - currency.

   It persists across pages and generates proforma invoices.

## 4. Design system

Two themes from one token set, each a complete, polished theme.

**Night theme**, from my original brief, the pitch default:

| Token | Value |
| --- | --- |
| Canvas | `#090E1A` |
| Panel surface | `#0D1527` |
| Elevated interactive | `#131E36` |
| Borders | `#1E293B`, flat and crisp. No glow, no neon. |

**Day theme**, from my energrid reference:
- light grey canvas, white panels and hairline grey borders;
- a grey grouped left navigation;
- a quiet top bar with search and link status;
- tidy KPI tiles and tables with comfortable rows;
- incident panels tinted only by severity.

**Functional colours (both themes)**

| Use | Colour |
| --- | --- |
| Safe / optimal / relay 4 | Emerald `#10B981` |
| Pre-hazard warning / relay 5 | Amber `#F59E0B` |
| Critical trip / relays 3 and 6 | Red `#DC2626` |
| Scrubber and fluid / relays 1 and 2 | Cyan `#0891B2` |
| E-commerce and checkout | Industrial orange `#F97316` |
| Primary action | Blue |

Every state is shown with colour plus text plus an icon, never colour alone.

**Typography:** Inter for headings and UI (400, 600, 700). JetBrains Mono for metrics, timers, formulas, registers and tag IDs, with tabular numerals.

**Spacing**
- Page containers `p-6 md:p-8 lg:p-10`, inside `max-w-7xl mx-auto`.
- `gap-6` or `gap-8` between grid items; `p-6` inside cards, never `p-2` or `p-3`.
- KPI rows are at most 4 across: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`.
- Table rows `py-4 px-6` with subtle zebra striping and no horizontal overflow on desktop. On mobile, wrap tables in `overflow-x-auto`.

**Shell**
- Left sidebar: a 64 px icon rail or a 260 px expanded drawer, with category dividers. It collapses on mobile and tablet.
- Sidebar groups:
  - Operations;
  - Process;
  - Safety;
  - Marketplace;
  - Compliance;
  - Support;
  - Administration.
- Top bar:
  - search;
  - data mode badge;
  - AWS link status (connected, messages per minute, last message);
  - unit, currency and theme toggles;
  - an alarm banner showing the highest unacknowledged alarm and the count;
  - the Master SCRAM button;
  - user menu.

**Industrial display practice (ISA-101 / ISA-18.2)**
- Show every analogue value against its range: a bar with the normal band and alarm limits marked, plus the number and the trend direction.
- Alarms carry a priority (critical, high, medium, low) and a state:
  - unacknowledged active;
  - acknowledged active;
  - returned unacknowledged;
  - shelved;
  - suppressed during warm-up.
- Software acknowledgement on screen is a separate action from the physical ACK button on the board. Label both clearly.
- Tag every signal with ISA-5.1-style IDs (for example `AT-101` ambient analyser, `AT-102` exhaust analyser, `XV-201` intake fan, `P-202` pump). Keep the list in `lib/tags.ts`.

**Craft rules**
- Motion only for state changes, 150 to 250 ms. Respect reduced-motion settings.
- Visible keyboard focus everywhere.
- No gradient text, no glow, no emoji as icons. Use one icon library (lucide-react).
- Every page has loading (skeletons), empty, error and stale-data states.

## 5. Tech stack and structure

- **Framework:** Next.js App Router, TypeScript strict, Tailwind, shadcn/ui components.
- **Data:** TanStack Query for server data; Zustand for global UI state (toggles, cart). Recharts for charts, with LTTB downsampling on long ranges. zod schemas in `lib/schema/` for every telemetry, API and form shape, validated on both client and server.
- **Auth:** Clerk with roles in public metadata: viewer, operator, supervisor, auditor, buyer, seller, admin. Every API route checks the role on the server (`lib/roles.ts`).
- **AWS:**
  - routes from guide section 6;
  - IoT publish for SCRAM;
  - DynamoDB for telemetry, events, commands, overrides, products, orders, audits, tickets and the audit log.
- **Payments:** Paystack test mode, split payments and a signed webhook, from guide section 8.
- **PDFs:** `@react-pdf/renderer` for:
  - proforma invoices;
  - certificates of analysis;
  - fuel spec sheets;
  - audit reports;
  - batch compliance ZIPs (with `jszip`).
- **Security:**
  - a content security policy and the other security headers in `next.config`;
  - rate limits on the command, override, checkout and ticket routes;
  - an append-only audit log of every command, approval, role change, setting change and report publish.
- **Structure:** one route folder per page. Shared components in `components/` (shell, KPI tile, analogue bar, trend chart, status badge, relay card, alarm table, modal, drawer). Page sections are separate components so no file grows unmanageable.

## 6. Pages: build every one

### Public and account

**Page 1: Landing (`/`)**
- **Hero:**
  - headline "Closed-Loop Flue Gas Sweetening & Circular Carbon Valorization.";
  - a clear explanation of the modular mini-refinery architecture;
  - CTAs: blue "Launch SCADA Console", slate "Browse Gas Marketplace".
- **Process flow diagram:** a clean 2D card, Mini-Refinery Furnace Flue → Chiller → Packed Absorption Column → NDIR Sensors → Storage Tanks. Draw it as SVG with animated flow lines.
- **Metric highlights:** 4 cards, 4,820 MT CO2 Abated, 98.7% Sweetening Yield, ₦18.4M Revenue Generated, 99.98% Interlock Uptime. Tag them as demo-scenario figures.
- **Value props:** 3 cards, Edge Gas Mitigation, 2-Second Staggered Scrubber Automation, Circular B2B Commodity Offtake.
- Navigation to sign in and sign up, and a footer.

**Sign up (`/sign-up`) and sign in (`/sign-in`)**
- Clerk components styled to the design system.
- After sign-up, an organisation setup step:
  - company name;
  - organisation type (plant operator, buyer, seller, auditor);
  - site location;
  - requested role.
- New users start as viewer, and an admin approves role upgrades on the admin page.
- **Demo quick-login:** five pre-created demo users, one per role, for the pitch. Their credentials live in Clerk, not in code.

### Console

**Page 2: AWS IoT Core hardware onboarding hub (`/onboarding`)**
- **Left column, provisioning form:**
  - Facility Name ("Niger Delta Mini-Refinery Complex #04");
  - Station ID ("ATMO-REF-NG-9842");
  - AWS Region dropdown. eu-west-1 is the default and is where IoT Core runs for this project. The list includes af-south-1, with a note that IoT Core is not offered there;
  - AWS IoT Endpoint URL;
  - Thing Name ("ESP32S3-N16R8-HARNESS-01");
  - MQTT Topic (default `clathrarefine/<thing>/telemetry`).

  The form saves the site and device record.
- **Right column, live connection diagnostics:**
  - a terminal-style log of real connection events from the device in LIVE mode;
  - ping latency measured with the `ping` command round trip (about 14 ms shown in DEMO mode);
  - a "Test AWS Connection" button that sends `ping` and waits for `cmd/ack`;
  - a "Download Device Certificates (.PEM)" button. It serves the public device certificate and Amazon Root CA 1 only, never the private key, and shows a note saying the private key stays with the device owner.

**Page 3: Executive plant dashboard (`/dashboard`)**
- **Top status bar:** facility location, shift ("Shift Alpha • Engr. T. Balogun"), red Master SCRAM button.
- **KPI cards:**
  1. Plant Safety Score: 98.4%, radial indicator, "aligned with ISO 45001 practice".
  2. Active Flue Gas: 418 PPM / 1,180 ADC, with a rolling line chart. LIVE mode shows the exhaust MQ-2 in mV.
  3. Ambient Leak Status: Normal, green tag. It follows the real ambient alarm level in LIVE mode.
  4. Daily CO2 Captured: 4.82 tCO2e, spot value ₦4,097,000 / $2,845.
- **Left half:** an interactive 2D plant compartment twin. Each processing stage shows flow, pressure and temperature, with the scrubber state from the firmware (IDLE, INTAKE_ACTIVE, SCRUBBING, PURGING) animating the right stages. Click a stage to open its tag detail.
- **Right half:** recent event log with severity badges (INFO, WARNING, PASS, AUDIT), fed from the device's events topic plus app events.

**Page 4: Live SCADA measurements and mass balance (`/measurements`)**
- **Formula card:** a large display of ṁ = (P × Q_gas / (R × T)) × (y_in − y_out) × M_CO2 with the current numbers, giving "184.2 kg/hr CO2 Captured".
- **Analyser cards, side by side:**
  - Inlet (C_in), GPIO 1: 11.2% Vol (112,000 PPM), 3,058 ADC.
  - Outlet (C_out), post-demister: 0.9% Vol (9,000 PPM), 245 ADC.
  - A centre pill: "91.96% Removal Efficiency (η)".
- **Secondary parameters:** 4 cards, Gas Flow 450 m3/h, Column ΔP 1.82 kPa (Normal), Lean vs Rich pH 12.4 → 8.1, Column Temp 42.4 °C.
- **Telemetry log:** a 5-row live stream with timestamp, readings, quality and status.
- **Trend panel:** multi-tag chart with alarm limits, event markers and a time-range picker (15 min, 1 h, 24 h, 7 d).
- **Tag faceplate drawer:** value, quality, range, limits, recent alarms and definition.

**Page 5: Departmental allocation and consumption (`/departments`)**
- **Quota card:** monthly carbon quota of 2,500 MT CO2e, 56.8% consumed, 1,080 MT surplus available for commercial sale. A "List surplus on marketplace" button creates a draft listing.
- **Table:** Crude Distillation (CDU), Gas Sweetening Scrubber, Flare Recovery Knockout, LPG Bottling Depot, Steam Boiler House. Columns:
  - Department;
  - Active Gas;
  - Flow Rate;
  - Emission Rate (kg/h);
  - Quota progress bar;
  - Operational Status.

  Sortable, with a row detail panel.

**Page 6: Six-relay actuator control and safety deck (`/relays`)**
- **Top controls:** mode switch "AUTOMATIC - Edge FSM" / "MANUAL OVERRIDE" and a Two-Person Security badge.
- **Six actuator cards, 3 × 2 grid:**
  - Relay 1 (GPIO 6): air intake fan.
  - Relay 2 (GPIO 7): CO2 liquid pump, with a 2.0 s sequential delay and a 5.0 s purge countdown timer.
  - Relay 3 (GPIO 8): red hazard light, trips at ADC ≥ 2300.
  - Relay 4 (GPIO 9): green normal light.
  - Relay 5 (GPIO 10): yellow pre-hazard light, 1200 ≤ ADC < 2300.
  - Relay 6 (GPIO 11): siren horn, 110 dB, muted or armed.

  Show the firmware's own thresholds in mV beside the ADC thresholds.
- **Each card has:**
  - a large status badge;
  - the load specification;
  - a manual pulse test button;
  - an override request button.

  Both buttons go through the two-person modal.
- **Event strip:** each relay's last 10 state changes.

**Page 7: Hazard alarms and escalation management (`/alarms`)**
- **Escalation strip:** three tiers:
  - Normal: 0 to 1199 ADC, green.
  - Pre-Hazard: 1200 to 2299 ADC, amber.
  - Critical Hazard: 2300 to 4095 ADC, red plus siren.

  Each tier shows the matching firmware mV thresholds and the live position of the ambient reading on the strip.
- **Active alarm list:** priority, tag, message, time, state, and software acknowledge and shelve actions (shelving needs a reason and an expiry).
- **Incident log table:** Alarm ID, Timestamp, Sensor Location, Peak Reading, Acknowledgement Status, Action. Plus history filters.
- **Alarm performance panel:**
  - alarms per 10 minutes;
  - standing alarms;
  - chattering alarms;
  - top 10 frequent alarms.

### Marketplace

**Page 8: B2B gas marketplace (`/marketplace`)**
A true modern B2B storefront, in the style of an industrial Jumia or Amazon.

- **Header:**
  - search: "Search by gas fraction, purity grade, cylinder skid, or ISO tanker...";
  - category pills: All Fractions, Liquid CO2 (Food/Cryo), Scrubbed Biomethane (Bio-CNG), Carbon Offsets (VCS), Specialty Syngas, plus Recovered Chemicals (sodium carbonate solution);
  - delivery location selector: Lagos Industrial Zone (Ikeja), Port Harcourt Terminal, Kano Depot;
  - a floating cart button with a count badge that opens the cart drawer.
- **Product grid:** 3 columns, with realistic industrial images. Use licensed stock or generated images stored in `public/images/`, with alt text.

  **Product 1: Liquid CO2, food and beverage grade, 99.98% purity**
  - Image: cryogenic road tanker or vacuum-insulated ISO tank.
  - Badges: "Target: E290 food grade", "99.98% Pure", "In Stock (42.0 MT Reserve)".
  - Description: direct solvent-scrubbed CO2, cryogenically purified for carbonated beverages, cold-chain dry ice and greenhouse enrichment.
  - Spec pills: Moisture < 5 ppm | Pressure 19.4 Bar | Temp −21.8 °C.
  - Packaging selector:
    - 50 L high-pressure cylinder: ₦45,000 ($31);
    - 1-ton skid: ₦120,000 ($83);
    - 10-ton cryogenic road tanker: ₦850,000 ($586).
  - Quantity stepper with a minimum order quantity.
  - Buttons: orange "Add to Cart / Request RFQ", slate "View Certificate of Analysis (COA)".

  **Product 2: Upgraded biomethane / scrubber-derived CNG, 98.5% CH4**
  - Image: 200-bar cylinder cascade trailer skid.
  - Badges: "Renewable Fuel Grade", "Desulfurized (< 2 ppm H2S)", "Immediate Dispatch".
  - Description: high-calorific CNG for turbine power generation and industrial boilers.
  - Spec pills: Wobbe Index 49.8 MJ/m3 | Pressure 200 Bar | Dew Point −40 °C.
  - Price: ₦320,000 ($220) per 250 m3 cascade skid.
  - Quantity stepper (default 2).
  - Buttons: "Add to Cart / Request RFQ", "Download Fuel Spec Sheet" (generates a PDF).

  **Product 3: Carbon offset tokens, 1 MT CO2e sequestration**
  - Image: a digital verification badge (authored SVG, no third-party logos).
  - Badges: "Target: Verra / Gold Standard", "Audited Hardware Provenance".
  - Description: carbon removal credit generated from the ESP32-S3-verified packed-bed scrubber.
  - Price: ₦35,500 ($24.50) per metric-ton token.
  - Quantity stepper (default 10 MT).
  - Buttons: "Buy & Retire Tokens", "Inspect Provenance Ledger". The ledger is an append-only, hash-chained record: each entry's SHA-256 covers the previous entry and the telemetry batch behind the credit.

  **Product 4: Sodium carbonate solution, recovered**
  - From the skid's solvent loop, sold by the litre.
  - Its provenance links to the scrubber's production lot.
- **Lot provenance panel** on every product: the site, the production period, and a small chart of the tag data behind the lot.
- **COA modal:**
  - a gas chromatography breakdown (CO2 purity, residual nitrogen, hydrocarbons, moisture, sulphur compounds);
  - a "Download Official Signed COA (.PDF)" button that generates the PDF, signed with the platform's document hash.
- **Cart and RFQ drawer:** slides in from the right.
  - Itemised manifest: product, quantity, unit price, subtotal.
  - Logistics:
    - Option A, "Buyer Self-Pickup (Ex-Works Port Harcourt Depot)", free;
    - Option B, "Dedicated Cryogenic Road Tanker Dispatch", +₦65,000.
  - Pricing summary in the active currency: subtotal, VAT 7.5%, ESG tax exemption credits, total due.
  - Escrow notice: "Payment is held securely in an audited Nigerian banking escrow account. Funds are released to the refinery only after physical weightbridge inspection and gas purity verification at your receiving dock." Mark it as the planned settlement model; the demo uses Paystack test mode.
  - Buttons: "Generate Proforma Invoice (PDF)", orange "Submit RFQ & Lock Escrow Slot".
- **Checkout:** pay by Paystack test card, using the split-payment flow from guide section 8.
- **Additional routes:**
  - `/marketplace/p/[id]` product detail;
  - `/marketplace/orders` buyer orders with status tracking;
  - `/marketplace/rfq` RFQ list and status;
  - `/marketplace/seller` seller centre: listings, create a listing from a production lot, incoming orders and RFQs.

**Page 9: Platform SaaS and commodity pricing (`/pricing`)**
- **Top half:** 3 tier cards:
  - Academic/Pilot Skid, ₦350,000/mo;
  - Modular Mini-Refinery, ₦1,250,000/mo, Most Popular;
  - Enterprise Complex, custom SLA.
- **Bottom half:** a gas offtake spot-rate table with spot prices, volume rebates (above 50 MT, 12% off) and delivery terms.

### Compliance

**Page 10: Safety and environmental audit workspace (`/audits`)**
- **Header:** active audit ID #AUD-2026-0891 and the lead auditor (a demo persona: Dr. Amina Bello, NESREA / ISO 14064), tagged Demo.
- **One-click hardware diagnostic card:** "[Execute One-Click Hardware Loop Diagnostic]". Pass/fail checks:
  - Exhaust Sensor Baseline (+0.03 V);
  - Ambient Response Time (142 ms);
  - Scrubber Pump 2.0 s Delay (2.01 s synchronised);
  - Scram Loop (18 ms).

  In LIVE mode, run the real checks:
  - ping round trip;
  - the last warm-up completed;
  - sensor fault clear;
  - baseline within limits;
  - the time between `INTAKE_ACTIVE` and `SCRUBBING` in the last event history.
- **Field observations form:**
  - solvent pH slider;
  - flange gasket ultrasonic leak result;
  - a file dropzone for FLIR thermal photos, stored in S3 through a signed upload URL.
- **Sign-off:** digital signature box, "Save Draft", "Lock & Publish ISO 14064 Report". Publishing generates the PDF, computes its SHA-256 and locks the record.

**Page 11: Audit history and statutory archive (`/audit-history`)**
- **Filters:** search, standard filter (ISO 14064, OSHA 1910, NESREA), date range picker, "Download Batch Compliance ZIP".
- **Table:** 6 rows. Columns: Audit ID, Timestamp, Auditor, Unit, Score (for example 98.4%), Status, SHA-256 hash (truncated, with copy) and PDF download.

**Page 12: 24/7 field support and chemical emergency desk (`/support`)**
- **Emergency banner:** red alert bar with the 24/7 hotline (+234 800-ATMO-VALOR, demo number) and the rapid dispatch SLA (< 8 seconds, target).
- **Left column, ticket form:**
  - Category;
  - Severity;
  - Problem description;
  - an "Attach 15-Min Sensor Snapshot" toggle that attaches the last 15 minutes of telemetry as CSV;
  - "Submit Priority Ticket".

  Ticket list and status below the form.
- **Right column, technical library:** one-click downloads for ESP32-S3 Wiring Schematics, Solvent SDS Sheets, NDIR Calibration Curves and the Clerk RBAC Matrix. Generate them from the guide content as PDFs.

### SCADA core pages, added to complete the system

- **`/fleet`:** all sites and devices with connection status, active alarms by priority and key values with quality. One real site (the skid) plus demo sites with clearly fictional names.
- **`/devices/[thing]`:**
  - last seen, connection, firmware, buffer count;
  - sensor fault, warm-up;
  - command history: SCRAM, ping, results.
- **`/events` and `/audit-log`:**
  - the full event journal;
  - the append-only audit trail of who did what, when and with what outcome.
- **`/shift`:** shift log entries and handover sign-off between shifts.
- **`/reports`:** daily and weekly summaries with charts, CSV and PDF export.
- **`/admin`:**
  - users and role approvals;
  - sites and devices;
  - the tag list;
  - alarm definitions;
  - the exchange rate setting (two-person);
  - marketplace moderation.

## 7. Security requirements

- Server-side role checks on every route and server action. Role matrix:

  | Role | Can do |
  | --- | --- |
  | Viewer | Read |
  | Operator | SCRAM and acknowledge |
  | Supervisor | Approve overrides, not their own |
  | Auditor | Audits |
  | Buyer and seller | Marketplace |
  | Admin | Everything except approving their own overrides |

- **Two-person rule:** enforced in DynamoDB with a condition that the approver differs from the requester. The PIN is hashed and compared on the server, with a rate limit.
- **Secrets:** none in client code. Environment variables only, listed in `.env.example` with placeholder values.
- **Headers and sessions:** a CSP and HSTS on every response, and an idle timeout of 30 minutes on console pages.
- **Logging:** every command, override, approval, role change, setting change, publish and payment is written to the audit log.

## 8. Performance and scale

- Largest contentful paint under 2.5 s on a mid-range phone over 4G. Console updates within 1 s of new data reaching the client.
- Smooth with 10 sites × 50 tags × 1 sample per 2 s in DEMO mode.
- Code-split the marketplace and compliance areas from the console. Virtualise long tables.

## 9. Content rules

- Keep every figure, name and label in this brief.
- Tag anything that is not from the real board or database as **Demo** or **Simulated**.
- Show certifications as targets.
- No third-party logos.

## 10. Verification at the end of the run

1. `npm run build`, `npm run lint` and `npm test` pass.
2. **Vitest:**
   - `lib/process.ts` (efficiency 91.96%, capture rate 184.2 kg/h with the demo inputs);
   - unit and currency conversion;
   - the alarm state machine;
   - quality and staleness;
   - the two-person logic.
3. **Playwright:**
   - every page loads in both themes and both data modes;
   - a viewer cannot SCRAM;
   - an operator SCRAM opens the two-person modal and is audited;
   - a supervisor cannot approve their own override;
   - add to cart, then proforma PDF, then Paystack test checkout;
   - the "Trigger leak" scenario drives the alarms page through warning, critical, SCRAM and recovery.
4. **Replay test:** a recorded session through `ReplaySource` produces the same alarm and scrubber timeline as the firmware's own events in that recording.
5. **Accessibility:** axe on every route with no serious violations.
6. **Screenshots:** take every page at 390 px and 1440 px wide in both themes, save them to `docs/screenshots/`, and fix layout issues you see.
7. **Report:** write `docs/BUILD_REPORT.md` and `docs/ASSUMPTIONS.md`.
