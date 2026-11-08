# Assumptions and decisions

Choices made where the briefs were unclear or conflicted, with the reason. Build brief = `docs/SCADA_BUILD_PROMPT.md`; modification brief = `docs/MODIFICATION_PROMPT.md`; guide = `docs/ClathraRefine-guide.md`.

## Safety and security

1. **SCRAM is one confirmed click, not two-person.** The build brief puts SCRAM behind the two-person modal; guide correction 14 says an emergency stop must not wait for a second person. SCRAM opens a confirmation modal (initiator, consequence, checkbox) and is audited; the two-person modal (second supervisor, PIN, checkbox, "Authorize Override") covers relay overrides, pulse tests, manual mode and setting changes. The Playwright test "operator SCRAM opens the modal and is audited" checks the SCRAM modal.
2. **Supervisor PIN hash may be base64-encoded.** Next's env loader expands `$` in values when a `.env` file exists, which corrupts a raw bcrypt hash. `SUPERVISOR_PIN_HASH` accepts the raw hash or its base64 (recommended, see `.env.example`).
3. **Self-approval is refused before the PIN is checked,** so a self-approval attempt never spends one of the five PIN tries per minute. The store condition (`requested_by <> me`) still guards the write.
4. **Demo quick-login** works only when Clerk keys are absent and `DEMO_AUTH=true`, so it can never bypass Clerk in production. It provides one user per role plus a second supervisor for the two-person rule.
5. **Any signed-in user can register their own first site** (first-run flow). Changing a site owned by someone else, including the seeded bench skid, needs admin.
6. **In-memory store when `AWS_ROLE_ARN` is unset.** Local runs and tests use a per-process map; production uses DynamoDB. Collections without a table in the guide share one extra table, `ClathraRecords` (`pk` = collection, `sk` = time-sortable id). Its IAM statement must be added to `ClathraDashboardRole`.
7. **Command acknowledgements** (`cmd/ack`) are not stored by the guide's rules. Ping round trips need an extra IoT rule `AckToStore` (`SELECT *, topic(2) AS device, ... FROM 'clathrarefine/+/cmd/ack'`) into `ClathraEvents`.
8. **Rate limits and the audit hash chain are per server instance** (marked `shortcut:` in code). Fine for one Vercel region at hackathon load; move to a shared store if traffic grows.
9. **Stock decrement** is an optimistic read-then-write with a condition (marked `shortcut:`), not an atomic `SET stock = stock - :q`.

## Data and maths

10. **Capture rate pressure.** The brief's 184.2 kg/h only comes out of ṁ = (P × Q / (R × T)) × Δy × M with P ≈ 236.9 kPa(abs) at 450 m³/h and 42.4 °C; at 1 atm the same inputs give 78.8 kg/h. The scenario uses 236,917 Pa and says so on screen.
11. **CO2 at 11.2% Vol.** The guide keeps simulated CO2 at or below 1% for the bench skid; the brief's plant scenario uses 11.2% inlet flue gas. Plant pages follow the brief (tagged Simulated); the bench simulator on the measurements page follows the guide (1% stream, eff0 0.6 shown as an assumption).
12. **ADC and millivolts** convert with the guide's own factor (about 1.178 mV per rev A count), marked as a shortcut to re-derive if the divider changes.
13. **USD values are computed, not copied.** The brief's "$2,845" for ₦4,097,000 does not match ₦1,450/$; the app converts at the rate setting ($2,825.52).
14. **Sodium carbonate price** is not in the brief: ₦2,500 per litre, MOQ 20 L (Demo).
15. **ESG tax exemption credit** = VAT credited back on carbon-offset lines; **volume rebate** = 12% off a line above 50 MT.
16. **Replay fixture is synthetic.** `fixtures/recordings/session-01.json` is firmware-shaped data, not a real S3 session. The replay test re-derives the alarm and scrubber timeline from recorded millivolts and infers ACK and SCRAM from recorded flags, so it becomes a real check as soon as a real recording is dropped in.
17. **Seeded audit hashes are real.** Seed audits carry no hash; the first listing renders each published audit to PDF and stores the PDF's SHA-256.
18. **Carbon token ledger issuance entries** are built from simulated scrubber batches (flagged `simulated: true`) the first time the ledger is read.

## Prediction (modification brief section 5)

19. **No `lib/model.json` is shipped.** There is no training data yet, and a made-up model card would be invented evidence. DEMO uses the scenario engine's look-ahead as the forecast (tagged Simulated, said in plain text); LIVE shows the empty state with training steps until `lib/model.json` exists. The model card shows real figures only from the file.
20. **Hazard risk index** = 100 × clamp(0.4 × position + 0.3 × forecast position + 0.15 × rise + 0.15 × anomaly), 100 at or above the trip. Position is measured from the warning release (1,310 mV) to the trip (2,710 mV). Unit tested in `lib/predict.test.ts`.
21. **Anomaly score without a model** is a robust z-score against the session's clean-air readings (threshold 6), tagged Simulated.
22. **The DEMO leak build-up was slowed** (warning at about 18 s, trip at 26 s, scripted SCRAM at 30 s, reset at 50 s) so the forecast visibly crosses the thresholds before the reading does.

## Product, copy and design

23. **Skills.** The Notion page's two skills were installed from their GitHub repositories as `apple-look` and `apple-motion` (the page's own renaming step; its code blocks would not render). `impeccable` was installed by copying its skill folder from the repository after review, because running the `skills` npx CLI was blocked as external code. Only the skills' written guidance was used; impeccable's downloaded binary and live-preview scripts were not run.
24. **shadcn/ui was not added.** The house components in `components/ui.tsx` (native `<dialog>` modal and drawer, buttons, tables) cover the same ground with less code. TanStack Query was replaced by a small `useFetch` hook and one shared session store.
25. **Long tables are paginated by slicing, not virtualised.** No table in the demo exceeds a few hundred rows.
26. **Product images are authored SVG illustrations,** not stock photos, so there are no licensing or third-party logo issues.
27. **Preferences persist per browser** (localStorage), not per account (marked `shortcut:`).
28. **KPI labels from the build brief keep their wording** (for example "Plant Safety Score"); new copy is sentence case.
29. **Marketplace browsing** lives at `/app/marketplace` and stays public; the marketing story is at `/product/marketplace`.
30. **Marketing revenue this month** on the dashboard story band is an illustrative Demo figure (₦3,260,000), tagged Demo.
31. **Contact leads** are stored in the `leads` collection; the confirmation email is a placeholder (marked `shortcut:`).
32. **Site URL** for metadata, sitemap and Open Graph comes from `NEXT_PUBLIC_SITE_URL`, defaulting to `https://clathrarefine.vercel.app`.
33. **Open Graph images** are generated per route group (home and other site pages share one card; each product and solution page gets its own title on the card).
34. **Company page team section** is a placeholder until real names are supplied.
35. **Demo seller and station names** were changed from event-specific names to neutral ones ("Demo Seller Ltd", `CLR-REF-NG-9842`) as part of removing event framing.
