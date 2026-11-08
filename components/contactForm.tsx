"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, ErrorNote, Field, inputCls, postJson } from "./ui";

const INDUSTRIES = ["Mini-refinery", "Gas processing", "LPG depot", "Chemical plant", "Boiler house", "Other"] as const;

export function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", company: "", industry: "Mini-refinery", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  if (done)
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-ok/50 bg-ok-bg p-6 text-ok-fg">
        <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Thanks, {f.name.split(" ")[0]}. Your request is in.</p>
          <p className="mt-1 text-sm">We will email {f.email} to arrange a time.</p>
        </div>
      </div>
    );
  return (
    <form
      className="grid grid-cols-1 gap-5 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr("");
        try {
          await postJson("/api/contact", f);
          setDone(true);
        } catch (x) {
          setErr((x as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field id="c-name" label="Your name">
        <input id="c-name" required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} />
      </Field>
      <Field id="c-email" label="Work email">
        <input id="c-email" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} />
      </Field>
      <Field id="c-company" label="Company">
        <input id="c-company" required autoComplete="organization" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} className={inputCls} />
      </Field>
      <Field id="c-ind" label="Industry">
        <select id="c-ind" value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} className={inputCls}>
          {INDUSTRIES.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field id="c-msg" label="What would you like to see? (optional)">
          <textarea id="c-msg" rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} className={inputCls} />
        </Field>
      </div>
      <div aria-hidden className="hidden">
        <label htmlFor="c-web">Website</label>
        <input id="c-web" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      </div>
      {err && (
        <div className="sm:col-span-2">
          <ErrorNote>{err}</ErrorNote>
        </div>
      )}
      <div className="sm:col-span-2">
        <Button variant="primary" type="submit" busy={busy} className="rounded-full px-6">
          Book a demo
        </Button>
      </div>
    </form>
  );
}
