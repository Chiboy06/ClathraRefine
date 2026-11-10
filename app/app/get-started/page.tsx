"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Radio } from "lucide-react";
import { Button, Card, ErrorNote, Field, inputCls, Notice, Page, postJson, cx } from "@/components/ui";
import { useMe } from "@/components/scada";
import { ConnectDevice } from "@/components/connect";
import { usePlant } from "@/lib/telemetry/usePlant";
import { formatTime } from "@/lib/format";

const STEPS = ["Create your account", "Set up your organisation", "Add your first site", "Connect a device", "Wait for first data", "Open the dashboard"];

export default function GetStarted() {
  const router = useRouter();
  const { me } = useMe();
  const p = usePlant();
  const [step, setStep] = useState(1);
  const [org, setOrg] = useState({ company: "", org_type: "plant operator", site: "", requested_role: "operator" });
  const [site, setSite] = useState({ facility: "", station: "", region: "eu-west-1", endpoint: "", thing: "", topic: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (fn: () => Promise<unknown>, next: number) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
      setStep(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const waiting = step === 4;
  const firstReading = waiting && p.mode === "LIVE" ? p.latest : null;

  return (
    <Page
      title="Get started"
      subtitle={`Welcome${me?.session ? `, ${me.session.name}` : ""}. Five short steps from sign-up to live readings.`}
    >
      <ol className="grid grid-cols-2 gap-2 md:grid-cols-6" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={cx("flex items-center gap-2 rounded-xl border p-3 text-sm", i < step ? "border-ok/50 bg-ok-bg text-ok-fg" : i === step ? "border-primary bg-primary-bg font-semibold text-primary-fg" : "border-line text-muted")}>
            <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs", i < step ? "border-ok" : "border-current")}>{i < step ? <Check aria-hidden className="h-3.5 w-3.5" /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      {err && <ErrorNote>{err}</ErrorNote>}

      {step === 1 && (
        <Card title="Set up your organisation">
          <form
            className="grid grid-cols-1 gap-6 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(() => postJson("/api/org", org), 2);
            }}
          >
            <Field id="gs-company" label="Company name">
              <input id="gs-company" required value={org.company} onChange={(e) => setOrg({ ...org, company: e.target.value })} className={inputCls} />
            </Field>
            <Field id="gs-type" label="Organisation type">
              <select id="gs-type" value={org.org_type} onChange={(e) => setOrg({ ...org, org_type: e.target.value })} className={inputCls}>
                {["plant operator", "buyer", "seller", "auditor"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field id="gs-loc" label="Site location">
              <input id="gs-loc" required value={org.site} onChange={(e) => setOrg({ ...org, site: e.target.value })} className={inputCls} placeholder="Port Harcourt, Rivers State" />
            </Field>
            <Field id="gs-role" label="Role you need" hint="You start as a viewer. An admin approves the role.">
              <select id="gs-role" value={org.requested_role} onChange={(e) => setOrg({ ...org, requested_role: e.target.value })} className={inputCls}>
                {["operator", "supervisor", "auditor", "buyer", "seller"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Button variant="primary" type="submit" busy={busy}>
                Save and continue
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === 2 && (
        <Card title="Add your first site">
          <form
            className="grid grid-cols-1 gap-6 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(() => postJson("/api/sites", { ...site, topic: `clathrarefine/${site.thing}/telemetry` }), 3);
            }}
          >
            <Field id="gs-fac" label="Facility name">
              <input id="gs-fac" required value={site.facility} onChange={(e) => setSite({ ...site, facility: e.target.value })} className={inputCls} />
            </Field>
            <Field id="gs-st" label="Station ID">
              <input id="gs-st" required value={site.station} onChange={(e) => setSite({ ...site, station: e.target.value })} className={inputCls + " font-mono"} />
            </Field>
            <Field id="gs-th" label="Device thing name" hint="Must match THING_NAME in the device firmware.">
              <input id="gs-th" required pattern="[A-Za-z0-9:_\-]+" value={site.thing} onChange={(e) => setSite({ ...site, thing: e.target.value })} className={inputCls + " font-mono"} placeholder="ESP32S3-N16R8-HARNESS-02" />
            </Field>
            <Field id="gs-reg" label="AWS region" hint="IoT Core runs in eu-west-1 for ClathraRefine.">
              <select id="gs-reg" value={site.region} onChange={(e) => setSite({ ...site, region: e.target.value })} className={inputCls}>
                <option value="eu-west-1">eu-west-1 (Ireland)</option>
                <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
              </select>
            </Field>
            <div className="md:col-span-2">
              <Button variant="primary" type="submit" busy={busy}>
                Save site
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === 3 && (
        <>
          <ConnectDevice embedded />
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              onClick={() => setStep(4)}
            >
              <Radio aria-hidden className="h-4 w-4" /> The device is powered, wait for data
            </Button>
          </div>
        </>
      )}

      {waiting && (
        <Card title="Waiting for the first reading">
          {firstReading ? (
            <div className="flex flex-col gap-4">
              <Notice tone="ok">
                First reading received at {formatTime(firstReading.receivedAt)}: ambient {firstReading.ambient_mv} mV, exhaust {firstReading.exhaust_mv} mV{firstReading.warming_up ? ". The sensors are warming up for 3 minutes." : "."}
              </Notice>
              <div>
                <Button variant="primary" onClick={() => router.push("/app")}>
                  Open the dashboard
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4" role="status" aria-live="polite">
              <div className="flex items-center gap-3 text-sm">
                <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> Listening for telemetry from AWS IoT Core. The board sends a reading every 2 s once Wi-Fi and MQTT connect.
              </div>
              {p.status.error && <Notice tone="warn">{p.status.error}. Check the board&apos;s Wi-Fi, the endpoint and that the certificate is active.</Notice>}
              <p className="text-sm text-muted">Not ready yet? You can connect later from Settings.</p>
            </div>
          )}
        </Card>
      )}
    </Page>
  );
}
