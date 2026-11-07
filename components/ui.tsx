"use client";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Info, Loader2, OctagonAlert, ShieldCheck, XCircle, Inbox, FlaskConical } from "lucide-react";
import type { Quality } from "@/lib/quality";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      <div className="flex flex-col gap-8">{children}</div>
    </div>
  );
}

export function Card({ title, actions, children, className, tone }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; tone?: Tone }) {
  return (
    <section className={cx("rounded-lg border bg-panel p-6", tone ? TONE_BORDER[tone] : "border-line", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export type Tone = "ok" | "warn" | "crit" | "fluid" | "shop" | "primary" | "neutral";
const TONE: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok-fg border-ok/40",
  warn: "bg-warn-bg text-warn-fg border-warn/40",
  crit: "bg-crit-bg text-crit-fg border-crit/50",
  fluid: "bg-fluid-bg text-fluid-fg border-fluid/40",
  shop: "bg-shop-bg text-shop-fg border-shop/40",
  primary: "bg-primary-bg text-primary-fg border-primary/40",
  neutral: "bg-elev text-muted border-line",
};
const TONE_BORDER: Record<Tone, string> = {
  ok: "border-ok/50",
  warn: "border-warn/50",
  crit: "border-crit/60",
  fluid: "border-fluid/50",
  shop: "border-shop/50",
  primary: "border-primary/50",
  neutral: "border-line",
};
const TONE_ICON: Record<Tone, typeof Info> = { ok: CheckCircle2, warn: AlertTriangle, crit: OctagonAlert, fluid: CircleDashed, shop: Info, primary: Info, neutral: Info };

/** Colour plus text plus icon, never colour alone. */
export function Badge({ tone = "neutral", children, icon = true, size = "sm" }: { tone?: Tone; children: ReactNode; icon?: boolean; size?: "sm" | "lg" }) {
  const Icon = TONE_ICON[tone];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-md border font-semibold whitespace-nowrap", TONE[tone], size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs")}>
      {icon && <Icon aria-hidden className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />}
      {children}
    </span>
  );
}

/** Marks values that do not come from the real board. */
export function SimTag({ kind = "Simulated" }: { kind?: "Simulated" | "Demo" }) {
  return (
    <span title={kind === "Simulated" ? "Calculated or modelled value, not a sensor reading" : "Demo scenario content"} className="inline-flex items-center gap-1 rounded border border-warn/40 bg-warn-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn-fg">
      <FlaskConical aria-hidden className="h-3 w-3" />
      {kind}
    </span>
  );
}

export function QualityBadge({ q }: { q: Quality }) {
  if (q === "Good") return <Badge tone="ok">Good</Badge>;
  if (q === "Uncertain") return <Badge tone="warn">Uncertain</Badge>;
  if (q === "Stale")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-elev px-2 py-0.5 text-xs font-semibold text-muted">
        <Clock aria-hidden className="h-3.5 w-3.5" /> Stale
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-crit/50 bg-crit-bg px-2 py-0.5 text-xs font-semibold text-crit-fg">
      <XCircle aria-hidden className="h-3.5 w-3.5" /> Bad
    </span>
  );
}

type BtnVariant = "primary" | "danger" | "slate" | "shop" | "ghost" | "ok";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary/90 border-primary",
  danger: "bg-crit text-white hover:bg-crit/90 border-crit",
  slate: "bg-slate text-white hover:bg-slate/90 border-slate",
  shop: "bg-shop text-slate-950 hover:bg-shop/90 border-shop",
  ok: "bg-ok text-slate-950 hover:bg-ok/90 border-ok",
  ghost: "bg-transparent text-fg hover:bg-elev border-line",
};
export function Button({ variant = "ghost", busy, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={cx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        BTN[variant],
        className,
      )}
    >
      {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Kpi({ label, value, sub, tone, tag, children }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; tag?: ReactNode; children?: ReactNode }) {
  return (
    <Card tone={tone}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
        {tag}
      </div>
      <div className="mt-3 font-mono text-2xl font-bold tabular">{value}</div>
      {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
      {children}
    </Card>
  );
}

export const KpiRow = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">{children}</div>;

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-md bg-elev", className)} />;
}
export function LoadingPanel({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line p-8 text-center text-sm text-muted">
      <Inbox aria-hidden className="h-6 w-6" />
      <div className="font-semibold text-fg">{title}</div>
      {children}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-crit/50 bg-crit-bg p-4 text-sm text-crit-fg">
      <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Notice({ tone = "primary", children }: { tone?: Tone; children: ReactNode }) {
  const Icon = tone === "ok" ? ShieldCheck : TONE_ICON[tone];
  return (
    <div role={tone === "crit" || tone === "warn" ? "alert" : "status"} className={cx("flex items-start gap-2 rounded-md border p-4 text-sm", TONE[tone])}>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Field({ label, hint, children, id }: { label: string; hint?: ReactNode; children: ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}
export const inputCls = "min-h-10 w-full rounded-md border border-line bg-elev px-3 py-2 text-sm text-fg placeholder:text-muted";

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-elev p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx("rounded px-2.5 py-1 text-xs font-semibold transition-colors duration-150", value === o.value ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Table wrapper: zebra rows, comfortable padding, scrolls on mobile only. */
export function Table({ head, children, caption }: { head: ReactNode[]; children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto lg:overflow-x-visible">
      <table className="w-full text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-6 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-zebra [&>tr]:border-b [&>tr]:border-line/60">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, mono, className }: { children: ReactNode; mono?: boolean; className?: string }) => <td className={cx("px-6 py-4 align-top", mono && "font-mono tabular", className)}>{children}</td>;

/** Small fetch hook: loading, error and data, with manual reload. */
export function useFetch<T>(url: string | null, deps: unknown[] = []) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: !!url });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => alive && setState({ data, loading: false }))
      .catch((e) => alive && setState({ error: e.message, loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, n, ...deps]);
  return { ...state, reload: () => setN((x) => x + 1) };
}

export async function postJson<T = unknown>(url: string, body: unknown, method = "POST"): Promise<T> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) {
    const t = await r.text();
    let msg = t;
    try {
      msg = JSON.parse(t).error ?? t;
    } catch {}
    throw new Error(msg || `HTTP ${r.status}`);
  }
  return r.json();
}

/** Downloads a server response (PDF, ZIP, CSV) as a file. */
export async function download(url: string, filename: string, init?: RequestInit) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
  const blob = await r.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return r.headers.get("X-Document-SHA256");
}
