"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Command, CornerDownLeft, Cpu, FileText, Moon, OctagonX, Radio, Search, Siren, Tag as TagIcon, type LucideIcon } from "lucide-react";
import { Modal, useMe } from "./scada";
import { Badge, cx, useFetch } from "./ui";
import { NAV } from "./nav";
import { TAGS } from "@/lib/tags";
import { SITES } from "@/lib/demoData";
import { usePrefs } from "@/lib/store";
import { usePlant } from "@/lib/telemetry/usePlant";
import { getHub } from "@/lib/telemetry/hub";
import { bannerAlarm } from "@/lib/alarms";
import { can } from "@/lib/roleMatrix";
import { formatDateTime } from "@/lib/format";

/** SCRAM opens from anywhere through one event, so the header button owns the single SCRAM modal. */
export const SCRAM_EVENT = "clathra:open-scram";

type Item = { id: string; label: string; hint: string; group: "Pages" | "Actions" | "Tags" | "Devices"; icon: LucideIcon; run: () => void };

export function CommandPalette() {
  const router = useRouter();
  const { me } = useMe();
  const { theme, mode, setTheme, setMode } = usePrefs();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("clathra:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("clathra:open-palette", onOpen);
    };
  }, []);

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => router.push(href);
    const actions: Item[] = [
      ...(can(me?.session?.role, "scram") ? [{ id: "scram", label: "Trigger SCRAM", hint: "Opens the SCRAM confirmation", group: "Actions" as const, icon: OctagonX, run: () => window.dispatchEvent(new Event(SCRAM_EVENT)) }] : []),
      ...(mode === "DEMO" ? [{ id: "leak", label: "Trigger leak (Demo)", hint: "Plays the hazard sequence", group: "Actions" as const, icon: Siren, run: () => getHub().triggerLeak() }] : []),
      { id: "mode", label: `Switch to ${mode === "DEMO" ? "LIVE" : "DEMO"} data`, hint: "Data mode", group: "Actions", icon: Radio, run: () => setMode(mode === "DEMO" ? "LIVE" : "DEMO") },
      { id: "theme", label: `Switch to ${theme === "night" ? "Day" : "Night"} theme`, hint: "Appearance", group: "Actions", icon: Moon, run: () => setTheme(theme === "night" ? "day" : "night") },
      { id: "connect", label: "Connect a device", hint: "Settings", group: "Actions", icon: Radio, run: go("/app/connect") },
      { id: "ticket", label: "Open a support ticket", hint: "Support desk", group: "Actions", icon: FileText, run: go("/app/support") },
    ];
    const pages: Item[] = NAV.flatMap((g) => g.items.map((i) => ({ id: `p-${i.href}`, label: i.label, hint: g.group, group: "Pages" as const, icon: i.icon, run: go(i.href) })));
    const tags: Item[] = TAGS.map((t) => ({ id: `t-${t.id}`, label: `${t.id} ${t.name}`, hint: t.source === "board" ? "Board tag" : "Simulated tag", group: "Tags", icon: TagIcon, run: go(`/app/measurements?tag=${t.id}`) }));
    const devices: Item[] = SITES.map((s) => ({ id: `d-${s.thing}`, label: s.thing, hint: s.name, group: "Devices", icon: Cpu, run: go(`/app/devices/${encodeURIComponent(s.thing)}`) }));
    return [...actions, ...pages, ...tags, ...devices];
  }, [router, me, mode, theme, setMode, setTheme]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? items.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(t)) : items).slice(0, 40);
  }, [items, q]);

  const close = () => {
    setOpen(false);
    setQ("");
    setSel(0);
  };
  const run = (i?: Item) => {
    if (!i) return;
    close();
    i.run();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="hidden min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-elev px-3 text-left text-sm text-muted hover:text-fg md:flex md:max-w-xs" aria-keyshortcuts="Control+K Meta+K">
        <Search aria-hidden className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">Search pages, tags, actions</span>
        <kbd className="inline-flex items-center gap-0.5 rounded border border-line px-1.5 font-mono text-[11px]">
          <Command aria-hidden className="h-3 w-3" />K
        </kbd>
      </button>
      <button onClick={() => setOpen(true)} aria-label="Search" className="rounded-lg p-2 text-muted hover:bg-elev md:hidden">
        <Search className="h-5 w-5" />
      </button>
      <Modal open={open} onClose={close} title="Go to or do">
        <div className="flex flex-col gap-3">
          <label htmlFor="palette-q" className="sr-only">
            Search pages, tags, devices and actions
          </label>
          <input
            id="palette-q"
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={shown[sel] ? `pal-${shown[sel].id}` : undefined}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(shown.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(shown[sel]);
              }
            }}
            placeholder="Type a page, tag such as AT-101, device or action"
            className="min-h-11 w-full rounded-lg border border-line bg-elev px-3 text-sm"
          />
          <ul id="palette-list" role="listbox" ref={listRef} aria-label="Results" className="max-h-80 overflow-y-auto">
            {shown.map((i, k) => (
              <li
                key={i.id}
                id={`pal-${i.id}`}
                role="option"
                aria-selected={k === sel}
                onMouseMove={() => setSel(k)}
                onClick={() => run(i)}
                className={cx("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm", k === sel && "bg-primary-bg text-primary-fg")}
              >
                <i.icon aria-hidden className={cx("h-4 w-4 shrink-0", i.id === "scram" && "text-crit-fg")} />
                <span className="flex-1 truncate">{i.label}</span>
                <span className="text-xs text-muted">{i.hint}</span>
                {k === sel && <CornerDownLeft aria-hidden className="h-3.5 w-3.5" />}
              </li>
            ))}
            {!shown.length && <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches. Try a page name or a tag such as AT-101.</li>}
          </ul>
        </div>
      </Modal>
    </>
  );
}

type Note = { id: string; kind: "Alarm" | "Approval" | "Order" | "Ticket"; text: string; at: number; href: string; tone: "crit" | "warn" | "primary" | "neutral" };

/** One place for alarms, approvals waiting on a second supervisor, orders and open tickets. */
export function NotificationCentre() {
  const router = useRouter();
  const p = usePlant();
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const signedIn = !!me?.session;
  const approvals = useFetch<{ id: string; status: string; kind: string; target: string; requested_name: string; created_at: number }[]>(signedIn ? "/api/overrides" : null, [open]);
  const orders = useFetch<{ id: string; status: string; created_at: number }[]>(signedIn ? "/api/market/orders" : null, [open]);
  const tickets = useFetch<{ id: string; status: string; severity: string; category: string; created_at: number }[]>(signedIn ? "/api/tickets" : null, [open]);
  const { count: alarmCount } = bannerAlarm(p.alarms);

  const notes: Note[] = [
    ...p.alarms.filter((a) => a.state === "UNACK_ACTIVE" || a.state === "RTN_UNACK").map((a) => ({ id: a.id, kind: "Alarm" as const, text: `${a.tag}: ${a.message}`, at: a.since, href: "/app/alarms", tone: a.priority === "critical" ? ("crit" as const) : ("warn" as const) })),
    ...(approvals.data ?? []).filter((r) => r.status === "pending").map((r) => ({ id: r.id, kind: "Approval" as const, text: `${r.requested_name} requested ${r.kind.replace("_", " ")} on ${r.target}`, at: r.created_at, href: "/app/relays", tone: "warn" as const })),
    ...(orders.data ?? []).slice(0, 5).map((o) => ({ id: o.id, kind: "Order" as const, text: `Order ${o.id.slice(0, 8)} is ${o.status.replace("_", " ")}`, at: o.created_at, href: "/app/marketplace/orders", tone: "primary" as const })),
    ...(tickets.data ?? []).filter((t) => t.status !== "Resolved").slice(0, 5).map((t) => ({ id: t.id, kind: "Ticket" as const, text: `${t.severity} ${t.category} ticket open`, at: t.created_at, href: "/app/support", tone: "neutral" as const })),
  ].sort((a, b) => b.at - a.at);
  const pendingCount = (approvals.data ?? []).filter((r) => r.status === "pending").length;
  const badge = alarmCount + pendingCount;

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" aria-label={`Notifications, ${badge} need attention`} className="relative rounded-lg border border-line p-2 hover:bg-elev">
        <Bell aria-hidden className="h-4 w-4" />
        {badge > 0 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-crit px-1.5 text-[10px] font-bold text-white">{badge}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-2 shadow-lg">
          <div className="px-2 py-1.5 text-sm font-semibold">Notifications</div>
          <ul className="max-h-96 overflow-y-auto">
            {notes.map((n) => (
              <li key={`${n.kind}-${n.id}`}>
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push(n.href);
                  }}
                  className="flex w-full flex-col gap-1 rounded-lg px-2 py-2 text-left text-sm hover:bg-elev"
                >
                  <span className="flex items-center gap-2">
                    <Badge tone={n.tone}>{n.kind}</Badge>
                    <span className="font-mono text-xs text-muted">{n.at ? formatDateTime(n.at) : ""}</span>
                  </span>
                  <span>{n.text}</span>
                </button>
              </li>
            ))}
            {!notes.length && <li className="px-2 py-6 text-center text-sm text-muted">Nothing needs you. New alarms, approvals, orders and tickets appear here.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
