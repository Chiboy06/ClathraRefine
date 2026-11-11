"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SignOutButton } from "@clerk/nextjs";
import { AlarmClock, Bot, LogOut, Moon, Radio, ShoppingCart, Sun, Wifi, WifiOff } from "lucide-react";
import { Mark } from "./mark";
import { AssistantLauncher } from "./assistant";
import { NAV, activeTab, isActive } from "./nav";
import { CommandPalette, NotificationCentre } from "./palette";
import { cx, Segmented, useMounted } from "./ui";
import { useMe } from "./scada";
import { ScramButton } from "./safety";
import { usePrefs, useCart } from "@/lib/store";
import { usePlant } from "@/lib/telemetry/usePlant";
import { bannerAlarm } from "@/lib/alarms";
import { formatTime } from "@/lib/format";
import { CartDrawer } from "./market";

/** Top tabs, always visible. */
function TabBar() {
  const path = usePathname();
  const tab = activeTab(path);
  return (
    // Fade mask on the right edge signals that more tabs are scrollable on narrow viewports.
    <nav
      aria-label="Sections"
      className="relative flex min-w-0 flex-1 overflow-x-auto"
      style={{ maskImage: "linear-gradient(to right, black calc(100% - 2.5rem), transparent)", WebkitMaskImage: "linear-gradient(to right, black calc(100% - 2.5rem), transparent)" }}
    >
      <ul className="flex items-stretch gap-1 pr-10">
        {NAV.map((t) => {
          const on = tab?.group === t.group;
          return (
            <li key={t.group}>
              <Link
                href={t.items[0].href}
                aria-current={on ? "page" : undefined}
                className={cx("flex h-12 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors duration-150", on ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg")}
              >
                <t.icon aria-hidden className="h-4 w-4" />
                {t.group}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The active tab's short sub-menu: left column on desktop, chips on mobile. */
function SubMenu() {
  const path = usePathname();
  const tab = activeTab(path);
  if (!tab) return null;
  return (
    <nav aria-label={`${tab.group} pages`} className="border-b border-line bg-nav lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
      <ul className="flex gap-1 overflow-x-auto p-2 lg:sticky lg:top-28 lg:flex-col lg:p-3">
        {tab.items.map((it) => {
          const on = isActive(path, it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={on ? "page" : undefined}
                className={cx("flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors duration-150", on ? "bg-primary-bg font-semibold text-primary-fg" : "text-muted hover:bg-elev hover:text-fg")}
              >
                <it.icon aria-hidden className="h-4 w-4 shrink-0" />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Active and unacknowledged alarms by priority, top right. */
function AlarmCounters() {
  const p = usePlant();
  const live = p.alarms.filter((a) => a.state === "UNACK_ACTIVE" || a.state === "ACK_ACTIVE" || a.state === "RTN_UNACK");
  const n = (pr: string) => live.filter((a) => a.priority === pr).length;
  const items = [
    { k: "critical", label: "Critical", cls: "bg-crit text-white" },
    { k: "high", label: "High", cls: "bg-warn text-slate-950" },
    { k: "medium", label: "Medium", cls: "bg-primary text-white", hideXs: true },
    { k: "low", label: "Low", cls: "bg-slate text-white", hideXs: true },
  ];
  return (
    <Link href="/app/alarms" className="relative flex items-center gap-1" data-testid="alarm-counters">
      <span className="sr-only">Alarms:</span>
      {items.map((i) => (
        <span key={i.k} title={`${i.label} alarms`} className={cx("h-7 min-w-7 items-center justify-center rounded-md px-1.5 font-mono text-xs font-bold tabular", (i as { hideXs?: boolean }).hideXs ? "hidden sm:inline-flex" : "inline-flex", n(i.k) ? i.cls : "bg-elev text-muted")}>
          {n(i.k)}
          <span className="sr-only"> {i.label.toLowerCase()},</span>
        </span>
      ))}
    </Link>
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
    <div
      className="relative"
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
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
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload drops in-memory session state after sign-out
                window.location.assign("/sign-in");
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
    <div className="flex items-center gap-2" aria-live="polite">
      {ok ? <Wifi aria-hidden className="h-4 w-4 text-ok-fg" /> : <WifiOff aria-hidden className="h-4 w-4 text-crit-fg" />}
      <span>
        {mode === "LIVE" ? "AWS IoT" : "Scenario"} {ok ? "connected" : p.status.error ? "error" : "offline"}
        <span className="ml-2 font-mono tabular">last {p.link.lastAt ? formatTime(p.link.lastAt).slice(0, 8) : "none"}</span>
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
    <div role="alert" aria-live="assertive" className={cx("border-b", crit ? "border-crit/60 bg-crit-bg" : "border-warn/50 bg-warn-bg")}>
      <Link href="/app/alarms" className={cx("flex items-center gap-2 px-4 py-2 text-sm font-semibold md:px-6", crit ? "text-crit-fg" : "text-warn-fg")}>
        <AlarmClock aria-hidden className="h-4 w-4 shrink-0" />
        <span className="uppercase">{top.priority}</span>
        <span className="font-mono">{top.tag}</span>
        <span className="truncate">{top.message}</span>
        <span className="ml-auto whitespace-nowrap rounded bg-panel/40 px-2 font-mono">{count} unacknowledged</span>
      </Link>
    </div>
  );
}

function Toggles() {
  const m = useMounted();
  const { unit, currency, theme, setUnit, setCurrency, setTheme } = usePrefs();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  if (!m) return <div className="h-8 w-64" aria-hidden />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented label="Concentration unit" value={unit} onChange={setUnit} options={[{ value: "PCT", label: "Vol %" }, { value: "PPM", label: "PPM" }]} />
      <Segmented label="Currency" value={currency} onChange={setCurrency} options={[{ value: "NGN", label: "₦ NGN" }, { value: "USD", label: "$ USD" }]} />
      <button onClick={() => setTheme(theme === "night" ? "day" : "night")} aria-label={`${theme === "night" ? "Night" : "Day"} theme, switch to ${theme === "night" ? "Day" : "Night"}`} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line bg-elev px-2.5 text-xs font-semibold">
        {theme === "night" ? <Moon aria-hidden className="h-3.5 w-3.5" /> : <Sun aria-hidden className="h-3.5 w-3.5" />}
        {theme === "night" ? "Night" : "Day"}
      </button>
    </div>
  );
}

function ModeBadge() {
  const m = useMounted();
  const mode = usePrefs((s) => s.mode);
  if (!m || mode === "LIVE") return null;
  // Only show the badge when in DEMO mode so operators know data is simulated
  return (
    <span data-testid="mode-badge" className="rounded-md border border-warn/50 bg-warn-bg px-2 py-0.5 font-mono text-xs font-bold text-warn-fg">
      <Radio aria-hidden className="mr-1 inline h-3.5 w-3.5" />
      SCENARIO
    </span>
  );
}

function CartButton() {
  const m = useMounted();
  const n = useCart((s) => s.lines.length);
  const setOpen = useCart((s) => s.setOpen);
  return (
    <button onClick={() => setOpen(true)} aria-label={`Open cart, ${m ? n : 0} items`} className="relative hidden rounded-md border border-line p-2 hover:bg-elev sm:block">
      <ShoppingCart aria-hidden className="h-4 w-4" />
      {m && n > 0 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-shop px-1.5 text-[10px] font-bold text-slate-950">{n}</span>}
    </button>
  );
}

const IDLE_MS = 30 * 60_000;

/** 30-minute idle timeout on console pages. */
function IdleTimer() {
  const { me } = useMe();
  // window.Clerk, not useClerk: the hook throws on builds without Clerk keys (local demo and e2e).

  useEffect(() => {
    if (!me?.session) return;
    let t: ReturnType<typeof setTimeout>;
    const out = async () => {
      if (me.auth === "clerk") {
        await (window as { Clerk?: { signOut: (o: { redirectUrl: string }) => Promise<void> } }).Clerk?.signOut({ redirectUrl: "/sign-in?reason=idle" });
      } else {
        await fetch("/api/demo-login", { method: "DELETE" });
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload drops in-memory session state after sign-out
        window.location.assign("/sign-in?reason=idle");
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
  // me.auth and me.session.userId are the real dependencies; the me object is new on every fetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.auth, me?.session?.userId]);

  return null;
}

function Clock() {
  const p = usePlant();
  return <span className="font-mono tabular">{p.now ? formatTime(p.now) : ""}</span>;
}

/** Always-visible status bar: time, link, data mode, assistant. Preferences live here too. */
function StatusBar() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-panel px-4 py-1 text-xs text-muted md:px-6" aria-label="Status">
      <Clock />
      <LinkStatus />
      <ModeBadge />
      <span className="inline-flex items-center gap-1">
        <Bot aria-hidden className="h-3.5 w-3.5" /> AI assistant: On
      </span>
      <div className="ml-auto">
        <Toggles />
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const setRate = usePrefs((s) => s.setRate);
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => s.usd_ngn_rate && setRate(s.usd_ngn_rate))
      .catch(() => {});
  }, [setRate]);
  return (
    <div className="flex min-h-screen flex-col pb-20">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-panel focus:p-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-panel">
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4 md:px-6">
          <Link href="/app" className="flex shrink-0 items-center gap-2 font-semibold">
            <Mark className="h-7 w-7" /> <span className="hidden sm:inline">ClathraRefine</span>
          </Link>
          <CommandPalette />
          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            <AlarmCounters />
            <NotificationCentre />
            <CartButton />
            <ScramButton />
            <UserMenu />
          </div>
        </div>
        <div className="border-t border-line px-2 md:px-4">
          <TabBar />
        </div>
        <AlarmBanner />
      </header>
      <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
        <SubMenu />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <StatusBar />
      <AssistantLauncher />
      <CartDrawer />
      <IdleTimer />
    </div>
  );
}
