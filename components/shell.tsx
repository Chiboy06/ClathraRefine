"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SignOutButton, useClerk } from "@clerk/nextjs";
import {
  Activity, AlarmClock, BarChart3, Bell, Boxes, ClipboardCheck, ClipboardList, Cpu, Factory, FileClock, FileText, Gauge, History, LayoutDashboard, LifeBuoy,
  LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Radio, ReceiptText, ScrollText, Search, Settings, ShoppingCart, Store, Sun, ToggleRight, Wifi, WifiOff, X, Tag as TagIcon, Network,
} from "lucide-react";
import { cx, Segmented, useMounted } from "./ui";
import { useMe } from "./scada";
import { ScramButton } from "./safety";
import { usePrefs, useCart } from "@/lib/store";
import { usePlant } from "@/lib/telemetry/usePlant";
import { bannerAlarm } from "@/lib/alarms";
import { formatTime } from "@/lib/format";
import { TAGS } from "@/lib/tags";
import { CartDrawer } from "./market";

type NavItem = { href: string; label: string; icon: typeof Gauge };
export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Operations", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/fleet", label: "Fleet", icon: Network },
    { href: "/devices/ESP32S3-N16R8-HARNESS-01", label: "Device", icon: Cpu },
    { href: "/events", label: "Event journal", icon: ScrollText },
    { href: "/shift", label: "Shift log", icon: ClipboardList },
  ] },
  { group: "Process", items: [
    { href: "/measurements", label: "Measurements", icon: Gauge },
    { href: "/departments", label: "Departments", icon: Factory },
    { href: "/reports", label: "Reports", icon: BarChart3 },
  ] },
  { group: "Safety", items: [
    { href: "/relays", label: "Relay deck", icon: ToggleRight },
    { href: "/alarms", label: "Alarms", icon: Bell },
  ] },
  { group: "Marketplace", items: [
    { href: "/marketplace", label: "Gas marketplace", icon: Store },
    { href: "/marketplace/orders", label: "My orders", icon: ReceiptText },
    { href: "/marketplace/rfq", label: "RFQs", icon: FileText },
    { href: "/marketplace/seller", label: "Seller centre", icon: Boxes },
    { href: "/pricing", label: "Pricing", icon: TagIcon },
  ] },
  { group: "Compliance", items: [
    { href: "/audits", label: "Audit workspace", icon: ClipboardCheck },
    { href: "/audit-history", label: "Audit history", icon: History },
    { href: "/audit-log", label: "Audit trail", icon: FileClock },
  ] },
  { group: "Support", items: [
    { href: "/support", label: "Field support", icon: LifeBuoy },
    { href: "/onboarding", label: "Device onboarding", icon: Radio },
  ] },
  { group: "Administration", items: [{ href: "/admin", label: "Admin", icon: Settings }] },
];

function Sidebar({ expanded, onToggle, mobileOpen, onCloseMobile }: { expanded: boolean; onToggle: () => void; mobileOpen: boolean; onCloseMobile: () => void }) {
  const path = usePathname();
  const nav = (wide: boolean) => (
    <nav aria-label="Main" className="flex flex-col gap-4 py-4">
      {NAV.map((g) => (
        <div key={g.group}>
          {wide ? <div className="px-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.group}</div> : <div className="mx-3 mb-2 border-t border-line" aria-hidden />}
          <ul>
            {g.items.map((it) => {
              const active = path === it.href || (it.href !== "/marketplace" && path.startsWith(it.href + "/")) || (it.href === "/marketplace" && path.startsWith("/marketplace/p/"));
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onCloseMobile}
                    aria-current={active ? "page" : undefined}
                    title={wide ? undefined : it.label}
                    className={cx("mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150", active ? "bg-primary-bg font-semibold text-primary-fg" : "text-muted hover:bg-elev hover:text-fg", !wide && "justify-center")}
                  >
                    <it.icon aria-hidden className="h-4 w-4 shrink-0" />
                    {wide ? it.label : <span className="sr-only">{it.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
  return (
    <>
      <aside className={cx("sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-line bg-nav lg:flex", expanded ? "w-[260px]" : "w-16")}>
        <div className={cx("flex h-16 items-center border-b border-line", expanded ? "justify-between px-5" : "justify-center")}>
          {expanded && (
            <Link href="/" className="flex items-center gap-2 font-bold">
              <Activity aria-hidden className="h-5 w-5 text-fluid" /> ClathraRefine
            </Link>
          )}
          <button onClick={onToggle} aria-label={expanded ? "Collapse navigation" : "Expand navigation"} className="rounded p-1.5 text-muted hover:bg-elev hover:text-fg">
            {expanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>
        {nav(expanded)}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-slate-950/60" onClick={onCloseMobile} />
          <aside className="absolute inset-y-0 left-0 w-[260px] overflow-y-auto border-r border-line bg-nav">
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <span className="flex items-center gap-2 font-bold">
                <Activity aria-hidden className="h-5 w-5 text-fluid" /> ClathraRefine
              </span>
              <button onClick={onCloseMobile} aria-label="Close navigation" className="rounded p-1.5 text-muted hover:bg-elev">
                <X className="h-4 w-4" />
              </button>
            </div>
            {nav(true)}
          </aside>
        </div>
      )}
    </>
  );
}

const SEARCH = [...NAV.flatMap((g) => g.items.map((i) => ({ label: i.label, href: i.href }))), ...TAGS.map((t) => ({ label: `${t.id} ${t.name}`, href: `/measurements?tag=${t.id}` }))];

function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className="relative hidden min-w-0 flex-1 md:block md:max-w-xs"
      onSubmit={(e) => {
        e.preventDefault();
        const hit = SEARCH.find((s) => s.label.toLowerCase().includes(q.toLowerCase()));
        if (hit) router.push(hit.href);
      }}
    >
      <label htmlFor="global-search" className="sr-only">
        Search pages and tags
      </label>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input id="global-search" list="search-list" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages and tags (AT-101)" className="min-h-10 w-full rounded-md border border-line bg-elev py-2 pl-9 pr-3 text-sm placeholder:text-muted" />
      <datalist id="search-list">
        {SEARCH.map((s) => (
          <option key={s.href + s.label} value={s.label} />
        ))}
      </datalist>
    </form>
  );
}

function ClerkSignOut() {
  return (
    <SignOutButton redirectUrl="/sign-in">
      <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-elev">
        <LogOut aria-hidden className="h-4 w-4" /> Sign out
      </button>
    </SignOutButton>
  );
}

function UserMenu() {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const s = me?.session;
  if (!s)
    return (
      <Link href="/sign-in" className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-elev">
        Sign in
      </Link>
    );
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm hover:bg-elev">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-bg text-xs font-bold text-primary-fg">{s.name.slice(0, 1)}</span>
        <span className="hidden text-left xl:block">
          <span className="block max-w-[10rem] truncate font-semibold leading-tight">{s.name}</span>
          <span className="block text-xs leading-tight text-muted">{s.role}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-56 rounded-md border border-line bg-panel p-1 shadow-lg">
          <div className="px-3 py-2 text-xs text-muted">
            Signed in as <span className="font-semibold text-fg">{s.name}</span> ({s.role}){s.demo && " · demo user"}
          </div>
          {me?.auth === "clerk" ? (
            <ClerkSignOut />
          ) : (
            <button
              role="menuitem"
              onClick={async () => {
                await fetch("/api/demo-login", { method: "DELETE" });
                location.href = "/sign-in";
              }}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-elev"
            >
              <LogOut aria-hidden className="h-4 w-4" /> Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LinkStatus() {
  const p = usePlant();
  const mode = usePrefs((s) => s.mode);
  const ok = p.link.connected;
  return (
    <div className="hidden items-center gap-2 text-xs xl:flex" aria-live="polite">
      {ok ? <Wifi aria-hidden className="h-4 w-4 text-ok-fg" /> : <WifiOff aria-hidden className="h-4 w-4 text-crit-fg" />}
      <span>
        <span className="font-semibold">{mode === "LIVE" ? "AWS IoT" : "Scenario"}</span> {ok ? "connected" : p.status.error ? "error" : "offline"}
        <span className="block font-mono text-muted tabular">
          {p.link.perMinute}/min · last {p.link.lastAt ? formatTime(p.link.lastAt).slice(0, 8) : "none"}
        </span>
      </span>
    </div>
  );
}

function AlarmBanner() {
  const p = usePlant();
  const { top, count } = bannerAlarm(p.alarms);
  if (!top) return null;
  const crit = top.priority === "critical";
  return (
    <Link href="/alarms" role="alert" className={cx("flex items-center gap-2 border-b px-4 py-2 text-sm font-semibold md:px-6", crit ? "border-crit/60 bg-crit-bg text-crit-fg" : "border-warn/50 bg-warn-bg text-warn-fg")}>
      <AlarmClock aria-hidden className="h-4 w-4 shrink-0" />
      <span className="uppercase">{top.priority}</span>
      <span className="font-mono">{top.tag}</span>
      <span className="truncate">{top.message}</span>
      <span className="ml-auto whitespace-nowrap rounded bg-panel/40 px-2 font-mono">{count} unacknowledged</span>
    </Link>
  );
}

function Toggles() {
  const m = useMounted();
  const { unit, currency, theme, mode, setUnit, setCurrency, setTheme, setMode } = usePrefs();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  if (!m) return <div className="h-8 w-64" aria-hidden />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented label="Data mode" value={mode} onChange={setMode} options={[{ value: "DEMO", label: "DEMO" }, { value: "LIVE", label: "LIVE" }]} />
      <Segmented label="Concentration unit" value={unit} onChange={setUnit} options={[{ value: "PCT", label: "Vol %" }, { value: "PPM", label: "PPM" }]} />
      <Segmented label="Currency" value={currency} onChange={setCurrency} options={[{ value: "NGN", label: "₦ NGN" }, { value: "USD", label: "$ USD" }]} />
      <button onClick={() => setTheme(theme === "night" ? "day" : "night")} aria-label={`Switch to ${theme === "night" ? "Day" : "Night"} theme`} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line bg-elev px-2.5 text-xs font-semibold">
        {theme === "night" ? <Moon aria-hidden className="h-3.5 w-3.5" /> : <Sun aria-hidden className="h-3.5 w-3.5" />}
        {theme === "night" ? "Night" : "Day"}
      </button>
    </div>
  );
}

function ModeBadge() {
  const m = useMounted();
  const mode = usePrefs((s) => s.mode);
  if (!m) return null;
  return (
    <span data-testid="mode-badge" className={cx("rounded-md border px-2 py-1 font-mono text-xs font-bold", mode === "LIVE" ? "border-ok/50 bg-ok-bg text-ok-fg" : "border-warn/50 bg-warn-bg text-warn-fg")}>
      {mode === "LIVE" ? "● LIVE" : "◆ DEMO"}
    </span>
  );
}

function CartButton() {
  const m = useMounted();
  const n = useCart((s) => s.lines.length);
  const setOpen = useCart((s) => s.setOpen);
  return (
    <button onClick={() => setOpen(true)} aria-label={`Open cart, ${m ? n : 0} items`} className="relative rounded-md border border-line p-2 hover:bg-elev">
      <ShoppingCart aria-hidden className="h-4 w-4" />
      {m && n > 0 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-shop px-1.5 text-[10px] font-bold text-slate-950">{n}</span>}
    </button>
  );
}

const IDLE_MS = 30 * 60_000;
function IdleClerk({ onIdle }: { onIdle: (fn: () => Promise<void>) => void }) {
  const clerk = useClerk();
  useEffect(() => onIdle(() => clerk.signOut({ redirectUrl: "/sign-in?reason=idle" })), [clerk, onIdle]);
  return null;
}
/** 30-minute idle timeout on console pages. */
function IdleTimer() {
  const { me } = useMe();
  const [clerkOut, setClerkOut] = useState<null | (() => Promise<void>)>(null);
  useEffect(() => {
    if (!me?.session) return;
    let t: ReturnType<typeof setTimeout>;
    const out = async () => {
      if (clerkOut) await clerkOut();
      else {
        await fetch("/api/demo-login", { method: "DELETE" });
        location.href = "/sign-in?reason=idle";
      }
    };
    const reset = () => {
      clearTimeout(t);
      t = setTimeout(out, IDLE_MS);
    };
    const evs = ["pointerdown", "keydown", "scroll"];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [me?.session, clerkOut]);
  return me?.auth === "clerk" ? <IdleClerk onIdle={(fn) => setClerkOut(() => fn)} /> : null;
}

export function Shell({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  const [mobile, setMobile] = useState(false);
  const setRate = usePrefs((s) => s.setRate);
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => s.usd_ngn_rate && setRate(s.usd_ngn_rate))
      .catch(() => {});
  }, [setRate]);
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-panel focus:p-2">
        Skip to content
      </a>
      <Sidebar expanded={expanded} onToggle={() => setExpanded((e) => !e)} mobileOpen={mobile} onCloseMobile={() => setMobile(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-panel">
          <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-2 md:px-6">
            <button onClick={() => setMobile(true)} aria-label="Open navigation" className="rounded p-2 text-muted hover:bg-elev lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <SearchBox />
            <ModeBadge />
            <LinkStatus />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Toggles />
              <CartButton />
              <ScramButton compact />
              <UserMenu />
            </div>
          </div>
          <AlarmBanner />
        </header>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <CartDrawer />
      <IdleTimer />
    </div>
  );
}
