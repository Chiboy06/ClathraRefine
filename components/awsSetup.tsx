"use client";
import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, Search } from "lucide-react";
import { Button, ErrorNote, Field, Notice, cx, inputCls } from "./ui";
import { api } from "@/convex/_generated/api";
import { convex } from "@/lib/convexClient";
import { formatTime } from "@/lib/format";

const CONVEX_SITE = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
const INGEST_URL = CONVEX_SITE ? `${CONVEX_SITE}/ingest` : "https://YOUR-DEPLOYMENT.convex.site/ingest";

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(text).then(() => (setDone(true), setTimeout(() => setDone(false), 1500)))}
          className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 text-xs font-semibold hover:bg-elev"
          aria-label={`Copy ${label}`}
        >
          {done ? <Check aria-hidden className="h-3.5 w-3.5 text-ok-fg" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
          {done ? "Copied" : "Copy"}
        </button>
      </div>
      <pre tabIndex={0} aria-label={label} className="max-h-72 overflow-auto rounded-lg border border-line bg-elev p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">{text}</pre>
    </div>
  );
}

function Part({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5" aria-labelledby={`aws-${n}`}>
      <h3 id={`aws-${n}`} className="mb-3 flex items-center gap-2 font-semibold">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-bg font-mono text-xs text-primary-fg">{n}</span>
        {title}
      </h3>
      <div className="flex flex-col gap-3 text-sm">{children}</div>
    </section>
  );
}

const Path = ({ children }: { children: ReactNode }) => <span className="font-semibold">{children}</span>;

/**
 * Everything needed to connect a board to this dashboard in the user's own AWS account, filled in from the form.
 * Provisioning stays in the AWS console: certificates and keys never pass through this app, and INGEST_KEY is never shown.
 */
export function AwsSetupGuide({ thing, region }: { thing: string; region: string }) {
  const [account, setAccount] = useState("");
  const [team, setTeam] = useState("");
  const [project, setProject] = useState("clathrarefine");
  const [check, setCheck] = useState<{ state: "idle" | "busy" | "ok" | "none" | "fail"; text?: string }>({ state: "idle" });
  const acct = /^\d{12}$/.test(account) ? account : "ACCOUNT_ID";
  const slug = team.trim() || "TEAM_SLUG";
  const t = thing.trim() || "THING_NAME";
  const arn = (kind: string, rest: string) => `arn:aws:iot:${region}:${acct}:${kind}/${rest}`;
  const consoleUrl = `https://${region}.console.aws.amazon.com/iot/home?region=${region}`;

  const devicePolicy = JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        { Effect: "Allow", Action: "iot:Connect", Resource: arn("client", t) },
        { Effect: "Allow", Action: "iot:Publish", Resource: ["telemetry", "events", "cmd/ack"].map((x) => arn("topic", `clathrarefine/${t}/${x}`)) },
        { Effect: "Allow", Action: "iot:Subscribe", Resource: arn("topicfilter", `clathrarefine/${t}/cmd`) },
        { Effect: "Allow", Action: "iot:Receive", Resource: arn("topic", `clathrarefine/${t}/cmd`) },
      ],
    },
    null,
    2,
  );
  const sql = (topic: string) => `SELECT *, topic(2) AS device, topic() AS topic FROM 'clathrarefine/+/${topic}'`;
  const trust = JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Federated: `arn:aws:iam::${acct}:oidc-provider/oidc.vercel.com/${slug}` },
          Action: "sts:AssumeRoleWithWebIdentity",
          Condition: {
            StringEquals: { [`oidc.vercel.com/${slug}:aud`]: `https://vercel.com/${slug}` },
            StringLike: { [`oidc.vercel.com/${slug}:sub`]: [`owner:${slug}:project:${project}:environment:production`, `owner:${slug}:project:${project}:environment:development`] },
          },
        },
      ],
    },
    null,
    2,
  );
  const publish = JSON.stringify({ Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: "iot:Publish", Resource: arn("topic", `clathrarefine/${t}/cmd`) }] }, null, 2);
  const secrets = `#pragma once
#include <pgmspace.h>

#define THING_NAME       "${t}"
#define WIFI_SSID        "your Wi-Fi name"
#define WIFI_PASS        "your Wi-Fi password"
#define AWS_IOT_ENDPOINT "xxxxxxxxxxxx-ats.iot.${region}.amazonaws.com"

// Paste each downloaded file between the brackets. Never commit this file.
static const char AWS_CERT_CA[] PROGMEM = R"EOF(
(paste the whole of AmazonRootCA1.pem here)
)EOF";
static const char AWS_CERT_CRT[] PROGMEM = R"EOF(
(paste the whole of xxxx-certificate.pem.crt here)
)EOF";
static const char AWS_CERT_PRIVATE[] PROGMEM = R"EOF(
(paste the whole of xxxx-private.pem.key here)
)EOF";`;
  const env = `AWS_ROLE_ARN=arn:aws:iam::${acct}:role/ClathraDashboardRole
AWS_REGION=${region}
IOT_ENDPOINT=xxxxxxxxxxxx-ats.iot.${region}.amazonaws.com
THING_NAME=${t}
NEXT_PUBLIC_THING_NAME=${t}`;

  const checkReadings = async () => {
    if (!convex) return setCheck({ state: "fail", text: "Convex is not configured on this build." });
    setCheck({ state: "busy" });
    try {
      const row = (await convex.query(api.telemetry.latest, { device: t })) as { ingest_ms?: number; fw?: string } | null;
      if (!row?.ingest_ms) return setCheck({ state: "none", text: `No reading from ${t} has reached the dashboard yet.` });
      const ago = Math.round((Date.now() - row.ingest_ms) / 1000);
      setCheck({ state: ago < 30 ? "ok" : "none", text: `Last reading ${formatTime(row.ingest_ms)} (${ago} s ago), firmware ${row.fw ?? "unknown"}.${ago >= 30 ? " The board has stopped sending or the rule has stopped forwarding." : ""}` });
    } catch (e) {
      setCheck({ state: "fail", text: /Sign in/.test((e as Error).message) ? "Sign in with your account to check." : (e as Error).message });
    }
  };

  return (
    <section aria-labelledby="aws-guide" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="aws-guide" className="text-xl font-semibold tracking-tight">Connect your AWS account</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">Do these steps once in your own AWS console. Every value below is filled in from this page, so you can copy and paste.</p>
        </div>
        <a href={consoleUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold hover:bg-elev">
          Open AWS IoT ({region}) <ExternalLink aria-hidden className="h-4 w-4" />
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-3">
        <Field id="aws-acct" label="AWS account ID" hint="12 digits, top right of the AWS console.">
          <input id="aws-acct" inputMode="numeric" value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="123456789012" className={inputCls + " font-mono"} />
        </Field>
        <Field id="aws-team" label="Vercel team slug" hint="The part after vercel.com/ in your team URL.">
          <input id="aws-team" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="my-team" className={inputCls + " font-mono"} />
        </Field>
        <Field id="aws-proj" label="Vercel project name">
          <input id="aws-proj" value={project} onChange={(e) => setProject(e.target.value)} className={inputCls + " font-mono"} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Part n="1" title="Register the board">
          <p>
            In AWS IoT open <Path>All devices › Things › Create things › Create single thing</Path>. Name it <code className="font-mono">{t}</code>, choose <Path>Auto-generate a new certificate</Path>, and download the device certificate, the private key and Amazon Root CA 1.
          </p>
          <p>
            Create the policy below in <Path>Security › Policies › Create policy</Path> (JSON tab), name it <code className="font-mono">ClathraDevicePolicy</code>, and attach it to the certificate. It lets this board use only its own topics.
          </p>
          <CopyBlock label="Device policy (JSON)" text={devicePolicy} />
          <Notice tone="warn">Keep the certificate and private key on your computer and in the firmware only. Never upload them to this app or commit them.</Notice>
        </Part>

        <Part n="2" title="Set up the firmware">
          <p>
            Find your endpoint in <Path>Settings › Device data endpoint</Path> and paste it into Step 3 above and into <code className="font-mono">secrets.h</code>. Then flash the board and watch the serial monitor for <code className="font-mono">[MQTT] Connecting to AWS IoT Core... Connected!</code>
          </p>
          <CopyBlock label="secrets.h template" text={secrets} />
        </Part>

        <Part n="3" title="Forward readings to this dashboard">
          <p>
            Open <Path>Message routing › Destinations › Create destination</Path>, choose <Path>HTTP destination</Path>, and enter the URL below. The dashboard confirms it on its own: wait until the status is <Path>Enabled</Path>.
          </p>
          <CopyBlock label="Destination URL" text={INGEST_URL} />
          <p>
            Open <Path>Message routing › Rules › Create rule</Path> three times, once for each statement, with SQL version <code className="font-mono">2016-03-23</code>. Do not use one rule on <code className="font-mono">clathrarefine/#</code>: it would also forward commands, which the dashboard rejects.
          </p>
          <CopyBlock label="Rule 1: telemetry" text={sql("telemetry")} />
          <CopyBlock label="Rule 2: events" text={sql("events")} />
          <CopyBlock label="Rule 3: command acknowledgements" text={sql("cmd/ack")} />
          <p>
            Give each rule an <Path>HTTPS</Path> action to the destination URL with one header named <code className="font-mono">x-ingest-key</code>. Its value is <code className="font-mono">INGEST_KEY</code> in the Convex dashboard under <Path>Settings › Environment variables</Path>. This app never shows it.
          </p>
          <p>Add an error action that writes to CloudWatch Logs so a failed post shows its reason. Remove any old DynamoDB actions. Keep the S3 action if you train models.</p>
        </Part>

        <Part n="4" title="Let the dashboard send commands">
          <p>
            SCRAM, ping, mode, fan and pump go from the dashboard to the board through AWS IoT. Vercel signs in to AWS with a short-lived token, so no AWS keys are stored anywhere.
          </p>
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            <li>In Vercel, <Path>Settings › Security</Path>: turn on OIDC Federation, Team issuer mode.</li>
            <li>
              In AWS, <Path>IAM › Identity providers › Add provider › OpenID Connect</Path>: URL <code className="break-all font-mono">https://oidc.vercel.com/{slug}</code>, audience <code className="break-all font-mono">https://vercel.com/{slug}</code>.
            </li>
            <li>
              Create the role <code className="font-mono">ClathraDashboardRole</code> with the trust policy, then add the permission policy as an inline policy.
            </li>
            <li>Add the environment variables to the Vercel project and redeploy.</li>
          </ol>
          <CopyBlock label="Trust policy (JSON)" text={trust} />
          <CopyBlock label="Permission policy (JSON)" text={publish} />
          <CopyBlock label="Vercel environment variables" text={env} />
        </Part>
      </div>

      <Part n="5" title="Check it works">
        <p>Power the board, wait 10 seconds, then check. A reading should arrive every 2 seconds.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="primary" busy={check.state === "busy"} onClick={checkReadings} data-testid="check-readings">
            <Search aria-hidden className="h-4 w-4" /> Check for readings from {t}
          </Button>
        </div>
        {check.text &&
          (check.state === "ok" ? (
            <Notice tone="ok">{check.text}</Notice>
          ) : check.state === "fail" ? (
            <ErrorNote>{check.text}</ErrorNote>
          ) : (
            <div className={cx("rounded-lg border border-warn/50 bg-warn-bg p-3 text-warn-fg")}>
              <p className="font-semibold">{check.text}</p>
              <ul className="mt-2 list-disc pl-5">
                <li>Serial monitor shows Connected? If not: Wi-Fi, endpoint, certificate active, or policy not attached.</li>
                <li>Destination status Enabled? If Pending, delete it and create it again.</li>
                <li>CloudWatch error log shows 401? The x-ingest-key header value does not match INGEST_KEY.</li>
                <li>Error log shows 400? The reading is missing fields; compare it with the firmware payload.</li>
                <li>Readings stored but not on the dashboard? THING_NAME and NEXT_PUBLIC_THING_NAME on Vercel must equal {t}.</li>
              </ul>
            </div>
          ))}
      </Part>
    </section>
  );
}
