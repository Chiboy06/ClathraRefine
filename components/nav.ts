import {
  BarChart3, Bell, Boxes, ClipboardCheck, ClipboardList, Cpu, Factory, FileClock, FileText, Gauge, History, LayoutDashboard, LifeBuoy,
  Radio, ReceiptText, ScrollText, Settings, Store, ToggleRight, Network, TrendingUp, LineChart as LineChartIcon, Droplets, Building2,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: typeof Gauge };
/** Navigation follows the product story: predict, prevent, capture, recover value. */
export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Overview", items: [
    { href: "/app", label: "Dashboard", icon: LayoutDashboard },
    { href: "/app/fleet", label: "Fleet", icon: Network },
    { href: "/app/devices/ESP32S3-N16R8-HARNESS-01", label: "Devices", icon: Cpu },
  ] },
  { group: "Predict", items: [
    { href: "/app/predict", label: "Hazard prediction", icon: TrendingUp },
    { href: "/app/measurements#trend", label: "Trends", icon: LineChartIcon },
  ] },
  { group: "Prevent", items: [
    { href: "/app/alarms", label: "Alarms and escalation", icon: Bell },
    { href: "/app/relays", label: "Safety deck", icon: ToggleRight },
    { href: "/app/events", label: "Event journal", icon: ScrollText },
    { href: "/app/audit-log", label: "Audit trail", icon: FileClock },
    { href: "/app/shift", label: "Shift log", icon: ClipboardList },
  ] },
  { group: "Capture", items: [
    { href: "/app/measurements", label: "Mass balance", icon: Gauge },
    { href: "/app/capture", label: "Solvent and scrubber", icon: Droplets },
    { href: "/app/departments", label: "Departments and quota", icon: Factory },
  ] },
  { group: "Marketplace", items: [
    { href: "/app/marketplace", label: "Marketplace", icon: Store },
    { href: "/app/marketplace/orders", label: "Orders", icon: ReceiptText },
    { href: "/app/marketplace/rfq", label: "RFQs", icon: FileText },
    { href: "/app/marketplace/seller", label: "Seller centre", icon: Boxes },
  ] },
  { group: "Compliance", items: [
    { href: "/app/audits", label: "Audit workspace", icon: ClipboardCheck },
    { href: "/app/audit-history", label: "Audit history", icon: History },
    { href: "/app/reports", label: "Reports", icon: BarChart3 },
  ] },
  { group: "Support", items: [{ href: "/app/support", label: "Support desk", icon: LifeBuoy }] },
  { group: "Settings", items: [
    { href: "/app/connect", label: "Connect a device", icon: Radio },
    { href: "/app/organisation", label: "Organisation", icon: Building2 },
    { href: "/app/admin", label: "Users, tags and alarms", icon: Settings },
  ] },
];

/** Exact match for the dashboard, prefix match elsewhere, hash links never active. */
export function isActive(path: string, href: string) {
  if (href.includes("#")) return false;
  if (href === "/app") return path === "/app";
  if (href === "/app/marketplace") return path === href || path.startsWith("/app/marketplace/p/");
  return path === href || path.startsWith(href + "/");
}


const LABELS: Record<string, string> = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.href.split("#")[0], i.label])));

/** Breadcrumbs from the path: App, then the nav group, then the page. */
export function crumbs(path: string): { href?: string; label: string }[] {
  if (!path.startsWith("/app")) return [];
  const out: { href?: string; label: string }[] = [{ href: "/app", label: "App" }];
  if (path === "/app") return [{ label: "Dashboard" }];
  const group = NAV.find((g) => g.items.some((i) => isActive(path, i.href)));
  if (group) out.push({ label: group.group });
  const base = Object.keys(LABELS).filter((h) => h !== "/app" && (path === h || path.startsWith(h + "/"))).sort((x, y) => y.length - x.length)[0];
  if (base && base !== path) out.push({ href: base, label: LABELS[base] });
  out.push({ label: base === path ? LABELS[base] : decodeURIComponent(path.split("/").pop() ?? "") });
  return out;
}
