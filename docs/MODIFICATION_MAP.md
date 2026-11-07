# Modification map

Every route before and after the repositioning brief (`docs/MODIFICATION_PROMPT.md`). Old app paths redirect permanently (308) to the new ones in `next.config.ts`.

## Marketing site (public, light theme)

| Before | After | What changes |
| --- | --- | --- |
| `/` | `/` | Rebuilt around Predict, Prevent, Capture, Recover value. Hero is an animated forecast curve. Product screenshots, industries, security, pricing teaser, capability facts beside the illustrative pilot metrics. "Open app" for signed-in users. |
| (none) | `/product/prediction`, `/product/prevention`, `/product/capture`, `/product/marketplace` | New. One dynamic route `app/(site)/product/[slug]` with static params. |
| (none) | `/solutions/[industry]` | New. Mini-refineries, gas processing, LPG depots, chemical plants, boiler houses. |
| `/pricing` (inside console shell) | `/pricing` (site) | Same tiers and spot-rate table, restyled in the site layout. |
| (none) | `/security`, `/company`, `/contact`, `/resources` | New. Contact form stores leads in the store (`leads` collection). Resources serves the public technical library. |
| `/sign-in`, `/sign-up` | same | Restyled; sign-up lands on the first-run flow. |
| (none) | 404, 500 | Site-styled `not-found.tsx`, `error.tsx`, `global-error.tsx`. |
| (none) | `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, icons, Open Graph images | New. App routes excluded from indexing. |

## App (signed in, under `/app`)

| Before | After | Nav group |
| --- | --- | --- |
| `/dashboard` | `/app` | Overview. New top story band (risk and forecast, prevention state, carbon today, marketplace revenue) above the existing KPIs, twin and event log. |
| `/fleet` | `/app/fleet` | Overview |
| `/devices/[thing]` | `/app/devices/[thing]` | Overview |
| (none) | `/app/predict` | Predict. New hazard prediction page. |
| `/measurements` | `/app/measurements` | Predict (trends) and Capture (mass balance) |
| `/alarms` | `/app/alarms` | Prevent |
| `/relays` | `/app/relays` | Prevent |
| `/events` | `/app/events` | Prevent |
| `/audit-log` | `/app/audit-log` | Prevent |
| `/shift` | `/app/shift` | Prevent |
| `/departments` | `/app/departments` | Capture |
| (none) | `/app/capture` | Capture. Solvent and scrubber status plus capture lots that start a marketplace listing. |
| `/marketplace`, `/marketplace/p/[id]`, `/marketplace/orders`, `/marketplace/rfq`, `/marketplace/seller` | `/app/marketplace/...` | Marketplace. Listings show "Captured at [site] on [dates]". Seller centre accepts `?lot=` from Capture. |
| `/audits`, `/audit-history`, `/reports` | `/app/audits`, `/app/audit-history`, `/app/reports` | Compliance |
| `/support` | `/app/support` | Support |
| `/onboarding` | `/app/connect` | Settings, renamed "Connect a device". Also step 4 of the first-run flow. |
| `/welcome` | `/app/organisation` | Settings |
| `/admin` | `/app/admin` | Settings (users and roles, tags, alarm definitions, exchange rate) |
| (none) | `/app/get-started` | First-run stepper: organisation, first site, connect a device, wait for first data, dashboard. "Use demo plant" skips to DEMO. |

## Shared components

| Component | Change |
| --- | --- |
| `components/shell.tsx` | Nav regrouped by the product story; command palette (Ctrl/Cmd+K); notification centre; breadcrumbs. SCRAM stays in the header and is also in the palette. |
| `components/ui.tsx` `Page` | Breadcrumbs above the title, one-line purpose, primary action on the right. Larger radii on surfaces. |
| `components/publicNav.tsx` | Replaced by the site header and footer with product and solutions menus and an "Open app" state. |
| `components/flow.tsx`, `plant.tsx`, `safety.tsx`, `market.tsx` | Links moved to `/app/...`. Safety modals unchanged. Product cards show capture provenance. |
| `lib/predict.ts` (new) | Hazard risk index and forecast-crossing calculation, unit tested. |
| `lib/telemetry/sources.ts` | Scenario exposes its look-ahead so DEMO prediction runs ahead of the alarm. |
