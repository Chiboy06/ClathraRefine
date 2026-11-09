"use client";
import { useState } from "react";
import { Save } from "lucide-react";
import { Button, Card, ErrorNote, Field, Notice, Page, inputCls, postJson, useFetch } from "@/components/ui";
import { useMe } from "@/components/scada";
import { SITE_DEFAULTS, type SiteDetails } from "@/lib/site";
import { can } from "@/lib/roleMatrix";

export default function SiteDetailsPage() {
  const { me } = useMe();
  const r = useFetch<Record<string, unknown>>("/api/settings");
  const saved = { ...SITE_DEFAULTS, ...((r.data?.site as Partial<SiteDetails>) ?? {}) };
  const [edit, setEdit] = useState<SiteDetails | null>(null);
  const f = edit ?? saved;
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const allowed = can(me?.session?.role, "approve_override");
  const text = (k: keyof SiteDetails, label: string) => (
    <Field id={`site-${k}`} label={label}>
      <input id={`site-${k}`} value={String(f[k])} onChange={(e) => setEdit({ ...f, [k]: typeof f[k] === "number" ? Number(e.target.value) : e.target.value })} type={typeof f[k] === "number" ? "number" : "text"} step="any" className={inputCls} disabled={!allowed} />
    </Field>
  );
  return (
    <Page title="Site details" subtitle="Shown on the plant overview.">
      <Card>
        <form
          className="grid grid-cols-1 gap-5 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await postJson("/api/settings", { id: "site", value: f });
              setMsg({ ok: true, t: "Saved." });
              r.reload();
            } catch (x) {
              setMsg({ ok: false, t: (x as Error).message });
            }
          }}
        >
          {text("plant", "Plant name")}
          {text("location", "Location")}
          {text("device", "Device (thing name)")}
          {text("firmware", "Firmware")}
          {text("sensors", "Sensors fitted")}
          {text("solventL", "Solvent volume (L)")}
          {text("solventM", "Solvent concentration (M NaOH)")}
          {text("commissioned", "Commissioned")}
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button variant="primary" type="submit" disabled={!allowed}>
              <Save aria-hidden className="h-4 w-4" /> Save
            </Button>
            {!allowed && <span className="text-sm text-muted">Supervisors and admins can edit site details.</span>}
          </div>
        </form>
        {msg && <div className="mt-4">{msg.ok ? <Notice tone="ok">{msg.t}</Notice> : <ErrorNote>{msg.t}</ErrorNote>}</div>}
      </Card>
    </Page>
  );
}
