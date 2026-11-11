import {
  Activity, Bell, Boxes, Bot, Box, BrainCircuit, CalendarRange, ClipboardCheck, ClipboardList, Cpu, Download, FileClock, FlaskConical, Gauge, GraduationCap, HeartPulse,
  LayoutDashboard, LifeBuoy, LineChart as LineChartIcon, ListTree, MapPin, Network, Radio, ReceiptText, ScrollText, ShieldAlert, ShieldCheck, SlidersHorizontal, Store, TrendingUp, Users, Workflow, Wind,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: typeof Gauge };
type Tab = { group: string; icon: typeof Gauge; items: NavItem[]; also?: string[] };

/** Top tabs, each with a short left sub-menu. `also` lists unlisted pages that belong to the tab. */
export const NAV: Tab[] = [
  { group: "Overview", icon: LayoutDashboard, items: [
    { href: "/app", label: "Plant overview", icon: LayoutDashboard },
    { href: "/app/fleet", label: "Fleet", icon: Network },
  ] },
  { group: "Monitoring", icon: Activity, items: [
    { href: "/app/monitoring", label: "Devices and signals", icon: ListTree },
    { href: "/app/monitoring/trends", label: "Live trends", icon: LineChartIcon },
  ] },
  { group: "Plant", icon: Workflow, items: [
    { href: "/app/plant", label: "Process diagram", icon: Workflow },
    { href: "/app/plant/3d", label: "3D plant view", icon: Box },
  ] },
  { group: "History", icon: CalendarRange, also: ["/app/capture", "/app/departments"], items: [
    { href: "/app/history", label: "CO2 and capture", icon: Wind },
    { href: "/app/history/gas", label: "Gas safety", icon: ShieldAlert },
    { href: "/app/history/alarms", label: "Alarms", icon: Bell },
    { href: "/app/history/export", label: "Export", icon: Download },
  ] },
  { group: "Alarms", icon: Bell, items: [
    { href: "/app/alarms", label: "Active", icon: Bell },
    { href: "/app/alarms/tiers", label: "Escalation tiers", icon: SlidersHorizontal },
    { href: "/app/alarms/events", label: "Event journal", icon: ScrollText },
    { href: "/app/alarms/audit", label: "Audit trail", icon: FileClock },
    { href: "/app/alarms/shift", label: "Shift log", icon: ClipboardList },
  ] },
  { group: "AI", icon: BrainCircuit, items: [
    { href: "/app/ai", label: "Assistant", icon: Bot },
    { href: "/app/ai/predictions", label: "Predictions", icon: BrainCircuit },
    { href: "/app/ai/sensor-health", label: "Sensor health", icon: HeartPulse },
    { href: "/app/ai/capture", label: "Capture performance", icon: TrendingUp },
    { href: "/app/ai/solvent", label: "Solvent forecast", icon: FlaskConical },
    { href: "/app/ai/training", label: "Training mode", icon: GraduationCap },
  ] },
  { group: "Marketplace", icon: Store, items: [
    { href: "/app/marketplace", label: "Catalogue", icon: Store },
    { href: "/app/marketplace/orders", label: "Orders and RFQs", icon: ReceiptText },
    { href: "/app/marketplace/seller", label: "Seller centre", icon: Boxes },
  ] },
  { group: "Settings", icon: SlidersHorizontal, also: ["/app/get-started", "/app/organisation"], items: [
    { href: "/app/settings/connect", label: "Connect a device", icon: Radio },
    { href: "/app/settings/site", label: "Site details", icon: MapPin },
    { href: "/app/settings/sensors", label: "Sensors and calibration", icon: Gauge },
    { href: "/app/settings/alarm-limits", label: "Alarm limits", icon: SlidersHorizontal },
  ] },
  { group: "Admin", icon: ShieldCheck, items: [
    { href: "/app/admin", label: "Users and roles", icon: Users },
  ] },
  { group: "Maintenance", icon: Cpu, also: ["/app/audit-history", "/app/devices"], items: [
    { href: "/app/maintenance", label: "Device health", icon: Cpu },
    { href: "/app/audits", label: "Audits", icon: ClipboardCheck },
    { href: "/app/support", label: "Support", icon: LifeBuoy },
  ] },
];

const under = (path: string, href: string) => path === href || path.startsWith(href + "/");

/** The sub-menu item for a path: the longest matching href. */
export function activeHref(path: string): string | null {
  const all = NAV.flatMap((t) => t.items.map((i) => i.href));
  return all.filter((h) => under(path, h)).sort((a, b) => b.length - a.length)[0] ?? null;
}

export const isActive = (path: string, href: string) => activeHref(path) === href;

export function activeTab(path: string): Tab | undefined {
  const h = activeHref(path);
  return NAV.find((t) => t.items.some((i) => i.href === h) || t.also?.some((a) => under(path, a)));
}

const LABELS: Record<string, string> = Object.fromEntries(NAV.flatMap((t) => t.items.map((i) => [i.href, i.label])));

/** Breadcrumbs from the path: the tab, then the page. */
export function crumbs(path: string): { href?: string; label: string }[] {
  const tab = activeTab(path);
  if (!tab) return [];
  const h = activeHref(path);
  const out: { href?: string; label: string }[] = [{ href: tab.items[0].href, label: tab.group }];
  if (h && h !== tab.items[0].href) out.push({ href: h, label: LABELS[h] });
  if (h !== path) out.push({ label: decodeURIComponent(path.split("/").pop() ?? "") });
  return out;
}
