"use client";
import { useState } from "react";
import { Button, Card, ErrorNote, Field, inputCls, Notice, Page, postJson } from "@/components/ui";
import { useMe } from "@/components/scada";
import { ROLES } from "@/lib/roleMatrix";

export default function Welcome() {
  const { me } = useMe();
  const [f, setF] = useState({ company: "", org_type: "plant operator", site: "", requested_role: "operator" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await postJson("/api/org", f);
      setDone(true);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="Organisation setup" subtitle={`Signed in as ${me?.session?.name ?? "…"}, current role ${me?.session?.role ?? "viewer"}.`}>
      <Card>
        {done ? (
          <Notice tone="ok">Request sent. You stay a viewer until an admin approves the role on the admin page.</Notice>
        ) : (
          <form onSubmit={submit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field id="org-company" label="Company name">
              <input id="org-company" required value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} className={inputCls} />
            </Field>
            <Field id="org-type" label="Organisation type">
              <select id="org-type" value={f.org_type} onChange={(e) => setF({ ...f, org_type: e.target.value })} className={inputCls}>
                {["plant operator", "buyer", "seller", "auditor"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field id="org-site" label="Site location">
              <input id="org-site" required value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} className={inputCls} placeholder="Port Harcourt, Rivers State" />
            </Field>
            <Field id="org-role" label="Requested role">
              <select id="org-role" value={f.requested_role} onChange={(e) => setF({ ...f, requested_role: e.target.value })} className={inputCls}>
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            {err && <ErrorNote>{err}</ErrorNote>}
            <div className="md:col-span-2">
              <Button variant="primary" busy={busy} type="submit">
                Request role
              </Button>
            </div>
          </form>
        )}
      </Card>
    </Page>
  );
}
