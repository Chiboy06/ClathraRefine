# ClathraRefine: remodification brief (simplify, smart assistant, real readings)

Save as `docs/REMODIFICATION_PROMPT.md`. In Claude Code, say:

> Read CLAUDE.md and docs/REMODIFICATION_PROMPT.md. Apply every change in one continuous run.

---

## 0. How to run this

- **The app exists. Remodify it.** Keep working features and data flows unless this brief changes or removes them.
- **Run the whole brief in one continuous pass. Do not stop for approval.**
  - Record assumptions in `docs/ASSUMPTIONS.md`.
  - Commit after each area.
  - Finish with section 12 and update `docs/BUILD_REPORT.md`.
- **Install and use these skills:**

  ```bash
  npx skills add vercel-labs/skills@find-skills
  npx skills add pbakaus/impeccable
  npx skills add anthropics/skills@frontend-design
  npx skills add vercel-labs/agent-skills@react-best-practices
  ```

  Then use find-skills to look for an official Convex skill and a three.js / react-three-fiber skill. Install them if they come from the official source with real usage:

  ```bash
  npx skills find convex
  npx skills find react three fiber
  ```

  Also apply the two Apple-standard skills from `docs/MODIFICATION_PROMPT.md` if they were installed.
- **Update `CLAUDE.md`** at the end to reflect every architecture change in this brief: Convex, the new firmware commands, the new pins, MQ-135, the Gemini assistant and the new navigation.

## 1. The product, restated

ClathraRefine is a **smart** industrial gas-leak prediction and prevention system with carbon capture.

"Smart" is the difference from ordinary SCADA. Ordinary SCADA shows numbers and raises alarms after a limit is crossed. ClathraRefine:
- predicts the hazard;
- explains it in plain words;
- walks the operator through what to do;
- keeps them updated without being asked.

The main focus of the screens is **CO2 readings and trends** (inlet, outlet, reduction, capture), alongside gas-leak safety.

Design goal: **an operator, or a trainee on their first day, understands the plant in seconds.** Simplicity beats completeness on every screen.

## 2. Reference: industrial monitoring software, simplified

Study the pattern of mature plant monitoring software such as Huawei SmartLogger / FusionSolar and utility single-line-diagram viewers. Do not copy their look; take their structure:
- **Top tabs:** a few, always visible. Each tab has a short left sub-menu.
- **Overview:** a plant picture beside a plant details table, then one strip of large key readings, then one trend chart with a simple series switch.
- **Monitoring:** a device tree on the left with status dots, and a signal table on the right (No., Signal, Value, Unit, Quality).
- **History:** Day / Month / Year / Custom tabs, a date picker with previous and next arrows, a bar or line chart, and a data table under it.
- **Plant diagram:** a dark live process drawing with values written on the equipment and controls on the equipment.
- **Status bar** at the bottom, always visible: time, link status, data mode, "AI assistant: On".
- **Alarm counters** by priority, top right, always visible.

Our version is cleaner and more modern: one typeface, generous spacing, no gradients, no bevels, crisp icons, light theme by default for the console, and a dark theme for the plant diagram.

## 3. Remove

- **Prose-heavy pages:**
  1. Delete every public page whose content is mostly long paragraphs. Candidates: `/product/*`, `/solutions/*`, `/company`, `/resources`, long `/security` text.
  2. Keep only `/`, `/pricing`, `/contact`, `/sign-in` and `/sign-up`.
  3. Redirect deleted routes to `/`.
- **The landing page:** short sections, at most two sentences of copy each, with real product screenshots doing the explaining.
- **In the app:** cut any explanatory paragraph longer than two sentences. Replace explanation with a "?" help popover per card, and with the assistant.
- **Device certificate handling:** remove the certificate download, the Amazon Root CA download and any certificate fields from the UI. AWS provisioning is done in the AWS console, not in this app.
- **Two-person approval** on relays and SCRAM (see section 7). Keep it only for safety bypasses and protected settings.

## 4. New navigation

**Top tabs** (each with a short left sub-menu):

| Tab | Sub-menu |
| --- | --- |
| Overview | Plant overview, Fleet |
| Monitoring | Devices and signals, Live trends |
| Plant | Process diagram (live mimic), 3D plant view |
| History | CO2 and capture, Gas safety, Alarms, Export |
| Alarms | Active, Escalation tiers, Event journal, Audit trail, Shift log |
| AI | Assistant, Predictions, Sensor health, Solvent forecast, Training mode |
| Marketplace | Catalogue, Orders and RFQs, Seller centre |
| Settings | Connect a device, Site details, Sensors and calibration, Users and roles, Alarm limits |
| Maintenance | Device health, Audits, Support |

Existing pages move into these places. Redirect their old routes.

**Always visible:**
- the alarm counters (top right);
- the SCRAM button (top bar);
- the assistant launcher (bottom right);
- the status bar (bottom).

## 5. Overview: an admin dashboard focused on CO2

Layout, top to bottom:

1. **Plant card.** Left: a 3D render of the skid (section 8). Right: a details table:
   - plant name and location;
   - device and firmware;
   - sensors fitted;
   - solvent volume and concentration;
   - commissioned date;
   - data mode.
2. **Key readings strip.** One row of large numbers, wrapping to two rows on small screens:

   | Reading | Display |
   | --- | --- |
   | Inlet CO2 | ppm and % Vol |
   | Outlet CO2 | ppm and % Vol |
   | CO2 reduction | % = (inlet − outlet) / inlet × 100 |
   | CO2 captured today | g or kg, and the running total |
   | Gas flow rate | L/min |
   | Liquid (solvent) flow rate | L/min |
   | Solvent temperature | °C |
   | Solvent pH | |
   | Ambient gas safety | level and mV |
   | Hazard risk | 0 to 100, with the forecast |

   - CO2 readings show as plain values (ppm and % Vol). Do not add any "Estimated" or "MQ-135" label to them anywhere in the UI.
   - Readings with no sensor fitted yet carry a small **Simulated** tag.
3. **One main trend chart.** Series switch: CO2 (inlet, outlet, reduction), Flows, Temperature and pH, Gas safety. Ranges: 15 min, 1 h, 24 h, 7 d.
4. **Two cards side by side:**
   - **AI briefing:** what changed in the last hour, what is predicted next, and what to do. Refreshed on events and every 15 minutes.
   - **Recent events:** with severity badges.

Formulas for the capture panel, in tested code `lib/process.ts`:
- reduction %;
- capture rate = gas flow × (inlet fraction − outlet fraction) × CO2 density (1.8 g/L near room temperature, adjustable);
- solvent loading % = captured mass / (0.55 g per litre × solvent litres) × 100.

## 6. Monitoring

- **Left: a device tree** with status dots:
  - ESP32-S3 controller;
  - ambient MQ-2 and exhaust MQ-2;
  - inlet MQ-135 and outlet MQ-135;
  - flow, temperature and pH sensors when fitted;
  - six relays;
  - scrubber.
- **Right: a signal table** for the selected device: No., Signal, Value, Unit, Quality, Last update.
- **Live trends:** pick any signals and plot them together.

## 7. Control from the plant diagram, done to industry practice

**SCRAM (emergency shutdown)**
- One deliberate action: press and hold 1 s, or press then confirm in the same spot.
- Any operator can use it. No PIN, no second person.
- In LIVE mode it publishes `{"cmd":"scram"}` and confirms from telemetry.

**Fan and pump on/off: select-before-operate**
1. The operator clicks the equipment on the diagram. A side panel opens with its state, interlocks and the allowed actions.
2. The operator chooses "Start" or "Stop". It arms for 10 s.
3. The operator presses "Execute". The command is sent.
4. The UI shows "Waiting for confirmation" until telemetry shows the new state, or "Rejected: [reason]" from the board's acknowledgement.

Every action is audited. Allowed roles: operator and supervisor.

**Safety bypass**
- What it covers: muting the siren from the app or extending manual mode while a hazard is active.
- It needs supervisor approval (a different person from the requester), a reason and an automatic expiry.
- The two-person flow and the server-side PIN hash stay for this, and for protected settings only.

**Firmware changes** (update `firmware/ClathraRefine/ClathraRefine.ino` and guide section 4)
- **Pins:**
  - Move the ACK button from GPIO4 to **GPIO12** (input with pull-up).
  - Inlet MQ-135 on **GPIO4** (ADC1_CH3) and outlet MQ-135 on **GPIO5** (ADC1_CH4), each with the same 10k/15k divider.
  - Do not use GPIO3 (strapping pin) or ADC2 pins (unreliable with Wi-Fi on).
- **New commands** on the existing `cmd` topic:
  - `{"cmd":"mode","value":"manual"|"auto"}`
  - `{"cmd":"fan","value":"on"|"off"}`
  - `{"cmd":"pump","value":"on"|"off"}`
- **Interlocks, enforced on the board** (the board refuses unsafe commands and says why in `cmd/ack` with `accepted:false` and a `reason`):
  - Manual commands only in manual mode. Manual mode cannot be entered while tripped, in SCRAM or warming up.
  - Fan ON is always allowed. Fan OFF is refused while exhaust gas is active, tripped or in SCRAM.
  - Pump ON requires the fan to be on and no trip. Pump OFF is allowed.
  - Automatic safety always wins. Any exhaust gas detection, critical ambient level, sensor fault or SCRAM returns the board to automatic control immediately.
  - Manual mode returns to automatic after 10 minutes without a command.
- **New telemetry fields:** `mode` (`AUTO`/`MANUAL`), `co2_in_mv` and `co2_out_mv`. Flow, temperature and pH fields are added when those sensors are fitted.
- **The AWS IoT policy needs no change**, because commands use the same topic.

## 8. Plant views

**Process diagram (live mimic)**, in the style of a single-line diagram:
- Dark background. Clean SVG symbols to ISA-5.1 style:
  - intake fan;
  - duct;
  - exhaust MQ-2;
  - inlet MQ-135;
  - packed absorption column;
  - solvent tank;
  - pump;
  - outlet MQ-135;
  - vent;
  - ambient MQ-2 in the room.
- Live values printed beside each instrument. Animated flow lines only while flow is on. Equipment colour shows state, with a text label as well.
- **Layer toggles:** values, flow animation, alarms, gas heat map (section 9, feature 5), interlocks.
- Click any equipment for select-before-operate (section 7).

**3D plant view:**
- A simple, clean 3D model of the skid, built with react-three-fiber from primitive shapes:
  - frame;
  - column;
  - tank;
  - pump;
  - fan with duct;
  - sensors as small labelled housings.
- Neutral materials, soft studio lighting, orbit controls, a reset-view button.
- Live state on the model: fan blades turn when on, a glow on the column while scrubbing, a red pulse on an alarmed sensor.
- The same render, as a still, is the plant picture on Overview. Label it "Illustrative model".

## 9. Sensors and readings

**CO2 from MQ-135:**
- Convert mV to resistance Rs using the module load resistor (a setting).
- Calibrate R0 in fresh air, assuming 420 ppm outdoor CO2. Store R0 per sensor in Settings, with a "Calibrate in fresh air" button that averages 60 s.
- Estimate ppm with the common MQ-135 CO2 curve, ppm = 116.6 × (Rs/R0)^−2.77, in one tested function.
- Show the values as plain CO2 readings. **Remove every instance of "Estimated", "Estimated (MQ-135)" and any similar caveat text** from all screens, tooltips, help popovers, assistant messages and exports. Search the codebase for them and delete them.
- The sensor model appears only where an instrument list normally shows it: the Monitoring device tree, and Settings, then "Sensors and calibration".
- Reduction % uses the same estimate for inlet and outlet.

**Flow, temperature, pH:**
- Live when fitted; otherwise Simulated by the scenario engine.
- Settings, then "Sensors and calibration", lists each sensor with fitted / not fitted, pin, calibration values and last calibration date.

## 10. AI: the smart layer

**Model provider**
- **Google Gemini** through the free tier of Google AI Studio. Use the official `@google/genai` SDK.
- The key is stored only on the server (a Convex environment variable, `GEMINI_API_KEY`).
- Keep the model name in one setting so it can change.
- Send no secrets or personal data in prompts.

**Assistant** (bottom-right launcher, and a full page under the AI tab)
- It answers questions about the plant with **tool calls only**, never from memory. Tools:
  - `getLatestReadings`;
  - `getTrend(tag, range)`;
  - `getActiveAlarms`;
  - `getEvents(range)`;
  - `getPrediction`;
  - `getSensorHealth`;
  - `getSolventForecast`;
  - `explainProcess(topic)`, which answers from a short built-in knowledge file about the skid.
- Every answer cites the readings and times it used.
- **Proactive updates:**
  - A short alert message whenever an alarm, prediction crossing, sensor-health warning or solvent warning occurs. It says what happened, why it matters and what to do next.
  - A briefing every 15 minutes while the console is open.
- **Walk-throughs:** step-by-step guidance for:
  - responding to a warning;
  - responding to a trip, ending with "press ACK on the board when readings are normal";
  - calibrating a sensor;
  - replacing solvent.
- **It never controls equipment.** It may recommend SCRAM and show the SCRAM button, but a person presses it.
- **Free-tier limits:** cache answers, queue proactive calls, and fall back to a rule-based message if the API is unavailable. Never block the console waiting for the AI.

**Prediction features**, each a card on the AI tab and summarised on Overview:

1. **Leak countdown:**
   - "Hazard level in N s" from the 30 s forecaster (guide section 7.5).
   - Shown on the diagram over the ambient sensor.
2. **Anomaly explainer:**
   - An anomaly score plus a one-line reason built from the features (rate of rise against baseline, level against normal band, time of day).
3. **Sensor health:**
   - Detect drift and failure by comparing each sensor's clean-air baseline over days, and the two MQ-2s against each other.
   - Output: "OK", "Drifting: calibrate", or "Suspect: check wiring", with evidence.
4. **Solvent exhaustion forecast:**
   - From the outlet/inlet CO2 ratio (breakthrough), solvent loading and pH when fitted.
   - Fit the trend and predict the time to 50% breakthrough: "Solvent saturated in about N min".
5. **Gas heat map:**
   - Interpolate gas level across the plant layout from the sensor positions (inverse-distance weighting).
   - Shown as a diagram layer.
   - Labelled "Indicative: improves with more sensors".
6. **Operator copilot:** the assistant above, including "why did X happen at time T?", and drafting the shift report from the shift's events.
7. **Training mode:**
   - Replays recorded or scenario incidents on the diagram at adjustable speed.
   - Pauses at decision points with a question; the assistant explains the right action.
   - Records a score per trainee.

All models are advisory, labelled as such, and shown with their version and accuracy figures. In DEMO mode the scenario engine drives them; in LIVE mode they use real telemetry.

## 11. Data back end: Convex, connected from AWS

**Why Convex:** live dashboards need instant updates. Convex queries are reactive, so screens update without polling.

**Pipeline:**
1. Board, then AWS IoT Core (unchanged).
2. An IoT rule with an **HTTPS action** on `clathrarefine/+/telemetry` and `clathrarefine/+/events` posts to a Convex HTTP action, `https://<deployment>.convex.site/ingest`. It sends header `x-ingest-key` with a long random secret. No Lambda is needed.
3. The `/ingest` HTTP action:
   - **Destination confirmation:** if the body has `confirmationToken` and `enableUrl` (AWS's check of the HTTPS destination), it fetches `enableUrl` once and returns 200.
   - **Authentication:** it checks `x-ingest-key` against the Convex environment variable `INGEST_KEY` and rejects anything else with 401.
   - **Validation:** it checks the payload with a validator and writes it to the `telemetry` or `events` table.
   - **Derived values:** it computes quality and the derived values (CO2 estimate, reduction, capture), and updates a `latest` document per device.
4. Keep the S3 archive rule for model training. DynamoDB tables are no longer needed by the app: migrate the reads to Convex and leave the tables for reference.
5. Use a scheduled Convex function to keep raw telemetry for 30 days. Keep hourly rollups (min, mean, max) indefinitely for History.

**Auth:** Clerk with Convex (`ConvexProviderWithClerk`, Clerk JWT template named `convex`). Role checks in every Convex query and mutation.

**Commands** (SCRAM and fan/pump):
- Keep the Next.js API route that publishes to AWS IoT through Vercel OIDC (keyless).
- Log each command in Convex.
- The board's `cmd/ack` reaches Convex through the same ingest rule (add `clathrarefine/+/cmd/ack` to it).

**Connect a device** (Settings, step by step):
1. Site name and location.
2. Thing name, which must match the AWS thing.
3. AWS region and IoT endpoint (no certificates).
4. Sensors fitted and their pins.
5. **"Test connection"**: the app sends `ping` and waits up to 10 s for `cmd/ack` through Convex. It shows "Connected: last message N s ago", or a clear failure with the likely cause.
6. **Waiting for first data**: a live counter that turns green when telemetry arrives.

Show the Convex ingest URL and how to add the IoT rule as a short checklist in a side panel. Never display `INGEST_KEY`.

**Limits:** note in `docs/BUILD_REPORT.md` that telemetry every 2 s, running 24/7, is about 1.3 million ingest calls a month. Compare that with the Convex plan's function-call allowance, and recommend a telemetry period if needed.

## 12. Checks at the end

1. `npm run build`, lint, unit tests and Playwright pass.
2. **New unit tests:**
   - MQ-135 conversion and R0 calibration;
   - reduction, capture and loading formulas;
   - the solvent forecast;
   - the sensor-health rules;
   - heat-map interpolation;
   - the select-before-operate state machine.
3. **New end-to-end tests:**
   - SCRAM is one hold action and works for an operator;
   - a viewer cannot SCRAM or operate equipment;
   - fan/pump select, then execute, then confirm, in DEMO mode;
   - a command rejected by an interlock shows its reason;
   - the assistant answers "what is the outlet CO2 now?" with the current value and its time;
   - "Connect a device" test-connection succeeds against the replay source.
4. **Ingest test:** post a sample telemetry message to `/ingest` with and without the key. The first is stored; the second gets 401.
5. **Firmware:** compiles in Arduino IDE settings from guide section 4. List the changes in `docs/BUILD_REPORT.md`.
6. **Screenshots** of every tab at 390 px and 1440 px. Review them with impeccable `critique` against the simplicity goal in section 1, and fix what it finds.
