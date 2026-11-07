# ClathraRefine: repositioning and redesign brief (modification of the existing build)

Save as `docs/MODIFICATION_PROMPT.md`. In Claude Code, say:

> Read CLAUDE.md and docs/MODIFICATION_PROMPT.md. Apply every change in one continuous run.

---

## 0. How to run this

**First step: install the Apple-standard design skills.**
1. Open this page: https://glamorous-pencil-2e4.notion.site/Make-Claude-Design-to-Apple-s-Standard-The-Two-Skills-3f6f8ee1272181bd8c0df0df5f912e8a
   - If your web fetch returns an empty Notion shell, render the page with Playwright: run headless Chromium, wait for network idle, scroll to the end, then read `document.body.innerText` and every link.
2. Install both skills it describes, using the exact commands or repositories on the page.
3. Read each skill's full instructions.
4. Apply both skills to all design work in this brief, alongside `impeccable` and `frontend-design`. Where the Apple skills and the other skills disagree on visual style, the Apple skills win. This brief's own stated values still win over all skills.
5. If the page cannot be read by any method, do not stop. Continue with `impeccable` and `frontend-design` applying Apple's Human Interface principles (clarity, deference, depth). State at the top of `docs/BUILD_REPORT.md` that the two skills could not be installed.

Take full responsibility for the result. Do not hand back partial work or ask me to finish steps that you can do yourself.

- **The app is already built. Modify it; do not rebuild it.** Keep every existing page, feature, component, route, test and data flow. Change positioning, copy, information architecture, page layout, visual design and flow as described here, and add the new pages listed.
- **Work in one continuous run.** Do not stop for approval. Record unclear choices in `docs/ASSUMPTIONS.md` and keep going.
- **Read the current code before you start.** Map every existing route and component into `docs/MODIFICATION_MAP.md`: current route, new route, and what changes. Then make the changes.
- **Build often.** Run `npm run build` after each area. Commit after each area with a clear message.
- **Finish with the checks in section 9,** fix what fails, then update `docs/BUILD_REPORT.md`.
- **Use the skills** for every UI change:
  - `impeccable`, with Persuade mode for the marketing site and Operate mode for the app;
  - `frontend-design`;
  - `react-best-practices`.

  Where this brief names a value, the brief wins.

## 1. What the product is

**ClathraRefine is an intelligent industrial hazard prediction and gas leakage prevention system with carbon capture.**

The product story runs in this order, everywhere: site, app navigation, onboarding and copy.

1. **Predict.** Models read live gas sensor data and forecast a hazard before it crosses an alarm threshold. Today that means a 30 s forecast and an anomaly score.
2. **Prevent.** The edge controller acts locally, in milliseconds, whether or not the cloud is reachable. It runs:
   - staged alarms with hysteresis;
   - a latched trip;
   - the siren;
   - SCRAM;
   - extraction and scrubbing.
3. **Capture.** Extracted gas passes through a liquid-solvent scrubber that captures CO2. The app tracks capture efficiency, solvent loading and the captured mass.
4. **Recover value.** Captured CO2 and recovered by-products are sold to other companies on the platform, with the production data behind every lot.

Positioning line for the site (refine the wording, keep the meaning): *"See gas hazards coming. Stop leaks at the source. Turn captured carbon into revenue."*

Who it is for: operators and safety managers at mini-refineries, gas processing plants, LPG depots, chemical plants and industrial boiler houses.

## 2. Global changes

1. **Remove all hackathon framing from the product UI and website:** NSChE, hackathon, Energenius Squad, "prototype", "pitch", "demo for judges", university references. Keep those only in `docs/`. After the change, this must find nothing in `app/`, `components/` or `public/`:

   ```bash
   grep -riE "hackathon|nsche|energenius|pitch|judge|university" app components public
   ```

2. **The name is ClathraRefine,** written exactly like that everywhere. Remove old names (AtmoValor, IGCI) from UI strings, metadata, the hotline label and topic placeholders shown to users. Keep the real MQTT topic `clathrarefine/<thing>/...`.
3. **Update `CLAUDE.md`:** replace its first paragraph with the product definition in section 1. Keep every rule in it unchanged.
4. **Keep the existing honesty labels.** Values that are not from a real sensor keep their "Demo" or "Simulated" tag. Certifications stay as "Target". The LIVE/DEMO mode switch stays inside the app.

## 3. Design direction: an Apple-quality SaaS product

Design it the way a funded industrial-software startup ships its site and app. The bar is Apple's product pages and Apple's interface principles:
- **Clarity:** every screen has one obvious job, and type and spacing make it readable at a glance.
- **Deference:** the interface steps back so the data and the product lead. Chrome is quiet.
- **Depth:** layers and motion explain where you are and what changed, nothing more.

**Marketing site, Persuade mode**
- **Pacing:** large, confident type and generous white space. One idea per section.
- **Hero:** one memorable moment: a live, animated hazard-prediction curve. The forecast line runs ahead of the real reading, the threshold is crossed in the forecast first, and the "Prevented" state appears. Build it in SVG or canvas from the scenario engine.
- **Imagery:** use real product screenshots of the app, rendered from the actual pages at 2x and framed cleanly, not stock dashboards. Industrial photography only where it adds context, stored in `public/images/` with alt text.
- **Theme:** light by default. One dark section is allowed for contrast (for example, the "Prevent" section).
- **Motion:** one orchestrated reveal per page at most. Scroll-linked motion only where it explains the product (Predict, then Prevent, then Capture). Respect reduced-motion settings.

**App, Operate mode**
- Keep Day and Night themes and the functional colour tokens, so the safety meaning of colour does not change.
- Calm, aligned, consistent. Same page header pattern on every page: title, one-line purpose, primary action on the right, breadcrumbs above.
- Add a command palette (Ctrl/Cmd+K) for pages, tags, devices and actions.
- Add a notification centre for alarms, approvals, orders and tickets.

**Type and tokens**
- Inter for UI and marketing, with a tighter display setting for headlines. JetBrains Mono only for values, tags, formulas and code.
- One type scale: fixed rem in the app, fluid only for marketing display headings.
- Radii: 12 to 16 px on large surfaces, smaller on controls. Declare elevation once per surface: border or shadow, not both.
- Banned:
  - eyebrow labels above headings;
  - gradient text;
  - glow;
  - emoji icons;
  - identical icon-card grids as page structure;
  - fake customer logos;
  - invented testimonials.

## 4. New information architecture

**Marketing site (public)**

| Route | Content |
| --- | --- |
| `/` | Home: hero (prediction moment); the problem (gas leaks, incidents, flaring, emissions); Predict, Prevent, Capture, Recover value as four sequential sections; how it works (sensor, edge controller, cloud, app, marketplace); live product screenshots; industries; security and reliability (local safety works offline); pricing teaser; final call to action |
| `/product/prediction` | Forecasting and anomaly detection: how it works, the model card, what it can and cannot do |
| `/product/prevention` | Edge interlocks: staged alarms, latched trip, SCRAM, two-person overrides, alarm management |
| `/product/capture` | Solvent scrubbing: efficiency, mass balance, solvent loading, captured-carbon reporting |
| `/product/marketplace` | Selling captured CO2 and by-products with production provenance |
| `/solutions/[industry]` | Mini-refineries, gas processing, LPG depots, chemical plants, boiler houses: their hazards and how ClathraRefine fits |
| `/pricing` | The existing tiers and the spot-rate table, restyled |
| `/security` | Safety architecture (cloud can never override local safety), data protection, roles, audit trail, certificate handling |
| `/company` | Mission, team (real names only if I add them; otherwise leave a placeholder), contact |
| `/contact` | "Book a demo" form, stored in DynamoDB with a confirmation email placeholder |
| `/resources` | The technical library from the support page, made public where safe |
| `/sign-in`, `/sign-up` | Existing Clerk flows, restyled |

Landing metrics (4,820 MT, 98.7%, ₦18.4M, 99.98%) stay, shown as an illustrative pilot scenario and tagged that way. Add capability facts beside them, which are true of the system:
- readings every 2 s;
- a 30 s forecast horizon;
- local trip response independent of the network;
- an offline buffer of about 2.3 hours.

**App**

Move every app page under `/app`, and redirect the old paths. Navigation is grouped by the product story:

| Group | Pages (existing pages keep their content) |
| --- | --- |
| Overview | Executive dashboard (`/app`), fleet, devices |
| Predict (new group) | **Hazard prediction** (new page, section 5), trends and measurements |
| Prevent | Alarms and escalation, six-relay safety deck, events, audit log, shift log |
| Capture | Measurements and mass balance, departments and quota, solvent and scrubber status |
| Marketplace | Marketplace, orders, RFQs, seller centre |
| Compliance | Audit workspace, audit history, reports |
| Support | Support desk |
| Settings | Onboarding hub (renamed "Connect a device"), organisation, users and roles, tags, alarm definitions, exchange rate |

The executive dashboard gets a new top band that tells the story at a glance:
- current hazard risk and its 30 s forecast;
- the prevention state (normal, warning or tripped, plus scrubber state);
- carbon captured today;
- marketplace revenue this month.

All the existing KPI cards, the plant twin and the event log stay below it.

## 5. New page: Hazard prediction (`/app/predict`)

- **Hazard risk index (0 to 100).** Compute it in a tested function from:
  - the ambient reading's position between its normal band and the critical threshold;
  - its rate of rise;
  - the anomaly score;
  - the forecast.

  Show it as the page's main element, with its trend.
- **Forecast chart:**
  - the real ambient reading;
  - the 30 s forecast line (from `lib/model.json`, guide section 7.5);
  - the warning and critical thresholds;
  - the moment the forecast first crosses each threshold, labelled "Predicted crossing in N s".
- **Anomaly panel:** the score, its threshold, and the last 10 anomalies with time and peak.
- **Leading indicators:** rate of rise, distance to the warning threshold, time since the last return to baseline, and sensor quality.
- **Model card:**
  - model version and training date;
  - forecast error against the no-change baseline;
  - exposures caught, median warning lead time and false alarms per hour (from the training report);
  - a plain statement that predictions are advisory and that safety actions are taken by the edge controller.
- **Modes:**
  - DEMO: the scenario engine supplies a realistic leak build-up so the prediction runs ahead of the alarm.
  - LIVE: uses real telemetry. If `lib/model.json` is missing, show an empty state explaining how to train and add the model.

## 6. Flow changes

1. **First run:**
   - sign up;
   - create the organisation;
   - add the first site;
   - "Connect a device" (the existing onboarding page as step 3 of a stepper);
   - wait for first data, with a live waiting state that ends when the first telemetry arrives;
   - the dashboard.

   Add a "Use demo plant" path that skips device connection and switches the account to DEMO mode.
2. **Signed-in users** who visit `/` see the site with an "Open app" button instead of "Sign in".
3. **Every empty state** explains what will appear and gives the next action.
4. **SCRAM and the two-person modal:** keep them exactly as they are. Make them reachable from the app header and the command palette.
5. **The marketplace's link to production:** each listing shows "Captured at [site] on [dates]", and the seller centre's "Create listing" starts from a capture lot on the Capture pages.

## 7. Copy rules

- **Plain, specific and benefit-led.** Say what the product does for an operator or a plant manager, in their words.
  - Good: "Know a leak is coming 30 seconds before the alarm."
  - Avoid: "AI-powered next-generation safety synergy."
- **Sentence case** everywhere. Active voice. Buttons name their action ("Book a demo", "Connect a device", "Trigger SCRAM").
- **No invented customers, logos, testimonials, awards or certifications.** Where social proof would go, use the capability facts or the illustrative pilot scenario, tagged as such.
- UK English, no em dashes.

## 8. SEO and polish

- **Every public page:**
  - a title and meta description;
  - an Open Graph image generated from the page's hero;
  - structured data for the organisation and software product.
- **Site files:** a favicon set and app icons from one ClathraRefine mark (authored SVG); `sitemap.xml` and `robots.txt`, with the app routes excluded from indexing.
- **Error pages:** a 404 and a 500 in the site's style.

## 9. Checks at the end of the run

1. `npm run build`, `npm run lint` and `npm test` pass; Playwright passes. Update the tests for the moved routes, and add tests for:
   - the redirects;
   - the first-run flow;
   - the "Use demo plant" path;
   - the prediction page in both modes.
2. **Unit tests** for the hazard risk index and the forecast-crossing calculation.
3. **The grep in section 2 returns nothing.**
4. **axe** on every route with no serious violations.
5. **Lighthouse on the marketing pages:** performance 90 or above on mobile, accessibility 100, SEO 100.
6. **Screenshots:** every marketing page and every app page at 390 px and 1440 px, in both app themes, saved to `docs/screenshots/after/`. Review them with impeccable's `critique` and fix what it finds.
7. **Reports:** update `docs/BUILD_REPORT.md` with a before-and-after list of routes, what changed on each page, and the test results.
