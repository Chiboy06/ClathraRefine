"use client";
import { useState } from "react";
import { DatabaseZap, Landmark, UserCog } from "lucide-react";
import { Badge, Button, Card, Empty, ErrorNote, Field, inputCls, LoadingPanel, Notice, Page, SimTag, Table, Td, postJson, useFetch } from "@/components/ui";
import { Mono, useMe } from "@/components/scada";
import { OverrideRequestModal, PendingApprovals, type OverrideSpec } from "@/components/safety";
import { useMoney } from "@/components/market";
import { ROLES } from "@/lib/roleMatrix";
import { TAGS } from "@/lib/tags";
import { usePrefs } from "@/lib/store";
import { FW } from "@/lib/process";
import type { Product } from "@/lib/demoData";

type U = { id: string; name: string; email?: string; role: string };
type RoleReq = { id: string; user_id: string; user_name: string; company: string; org_type: string; site: string; requested_role: string; status: string };
type Site = { id: string; name: string; thing: string; region: string; real: boolean };

const ALARM_DEFS = [
  { id: "ALM-AT101-HIHI", tag: "AT-101", pri: "critical", set: `≥ ${FW.AMB_CRIT_ON_MV} mV`, clear: `≤ ${FW.AMB_CRIT_OFF_MV} mV`, src: "Firmware level CRITICAL" },
  { id: "ALM-AT101-HI", tag: "AT-101", pri: "high", set: `≥ ${FW.AMB_WARN_ON_MV} mV`, clear: `≤ ${FW.AMB_WARN_OFF_MV} mV`, src: "Firmware level WARNING" },
  { id: "ALM-HS001", tag: "HS-001", pri: "critical", set: "scram = true", clear: "ACK at board", src: "Telemetry flag" },
  { id: "ALM-TRIP", tag: "XA-206", pri: "high", set: "trip_latched = true", clear: "ACK at board when NORMAL", src: "Telemetry flag" },
  { id: "ALM-SENSOR", tag: "AT-101", pri: "high", set: "sensor_fault or < 100 mV", clear: "Reading restored", src: "Telemetry flag" },
  { id: "ALM-STALE", tag: "HS-001", pri: "medium", set: "No reading for 10 s", clear: "Next reading", src: "Dashboard" },
];

export default function Admin() {
  const { me } = useMe();
  const money = useMoney();
  const rate = usePrefs((s) => s.rate);
  const [n, setN] = useState(0);
  const users = useFetch<{ users: U[]; requests: RoleReq[] }>("/api/admin/roles", [n]);
  const sites = useFetch<Site[]>("/api/sites", [n]);
  const products = useFetch<Product[]>("/api/market/products", [n]);
  const [spec, setSpec] = useState<OverrideSpec | null>(null);
  const [newRate, setNewRate] = useState(1450);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const run = async (k: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(k);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, t: ok });
      setN((x) => x + 1);
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const isAdmin = me?.session?.role === "admin";

  return (
    <Page title="Administration" subtitle="Users and roles, sites and devices, tags, alarm definitions, exchange rate and marketplace moderation.">
      {me && !isAdmin && <Notice tone="warn">Admin role required for most actions here. The server enforces this.</Notice>}
      {msg && (msg.ok ? <Notice tone="ok">{msg.t}</Notice> : <ErrorNote>{msg.t}</ErrorNote>)}

      <Card title="Users and role approvals">
        {users.loading && <LoadingPanel />}
        {users.error && <ErrorNote>{users.error}</ErrorNote>}
        {users.data && (
          <div className="flex flex-col gap-6">
            {users.data.requests.filter((r) => r.status === "pending").length > 0 && (
              <Table head={["Requester", "Company", "Type", "Site", "Requested role", ""]} caption="Pending role requests">
                {users.data.requests
                  .filter((r) => r.status === "pending")
                  .map((r) => (
                    <tr key={r.id}>
                      <Td>{r.user_name}</Td>
                      <Td>{r.company}</Td>
                      <Td>{r.org_type}</Td>
                      <Td>{r.site}</Td>
                      <Td mono>{r.requested_role}</Td>
                      <Td>
                        <Button variant="primary" busy={busy === r.id} onClick={() => run(r.id, () => postJson("/api/admin/roles", { userId: r.user_id, role: r.requested_role, request_id: r.id }), "Role approved.")}>
                          Approve
                        </Button>
                      </Td>
                    </tr>
                  ))}
              </Table>
            )}
            <Table head={["User", "Email", "Role", "Change role"]} caption="Users">
              {users.data.users.map((u) => (
                <tr key={u.id}>
                  <Td>{u.name}</Td>
                  <Td mono>{u.email}</Td>
                  <Td>
                    <Badge tone="primary">{u.role}</Badge>
                  </Td>
                  <Td>
                    <label htmlFor={`role-${u.id}`} className="sr-only">
                      Role for {u.name}
                    </label>
                    <select
                      id={`role-${u.id}`}
                      value={u.role}
                      disabled={u.id === me?.session?.userId}
                      onChange={(e) => run(u.id, () => postJson("/api/admin/roles", { userId: u.id, role: e.target.value }), `Role for ${u.name} changed.`)}
                      className={inputCls + " w-40"}
                    >
                      {ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </Td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card title="Exchange rate (two-person)">
          <p className="mb-4 text-sm">
            Current: <Mono className="font-semibold">₦{rate.toLocaleString("en-GB")} per $1.00</Mono>
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field id="rate" label="New rate (₦ per $1)">
              <input id="rate" type="number" min={100} max={10000} value={newRate} onChange={(e) => setNewRate(Number(e.target.value))} className={inputCls + " w-40"} />
            </Field>
            <Button
              variant="primary"
              disabled={!isAdmin && me?.session?.role !== "supervisor"}
              onClick={() => setSpec({ kind: "setting", target: "usd_ngn_rate", value: newRate, title: "Change exchange rate", consequence: `Every USD price in the marketplace and pricing pages will use ₦${newRate.toLocaleString("en-GB")} per $1.00.` })}
            >
              <Landmark aria-hidden className="h-4 w-4" /> Request rate change
            </Button>
          </div>
        </Card>
        <Card title="Sites and devices">
          {sites.data ? (
            <ul className="flex flex-col gap-2 text-sm">
              {sites.data.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{s.name}</span> <Mono className="text-muted">{s.thing}</Mono> <Badge tone="neutral">{s.region}</Badge> {!s.real && <SimTag kind="Demo" />}
                </li>
              ))}
            </ul>
          ) : (
            <LoadingPanel />
          )}
          <div className="mt-4">
            <Button disabled={!isAdmin} busy={busy === "seed"} onClick={() => run("seed", () => postJson("/api/admin/seed", {}), "Demo catalogue and records loaded into the store.")}>
              <DatabaseZap aria-hidden className="h-4 w-4" /> Load demo data into store
            </Button>
          </div>
        </Card>
      </div>

      <Card title="Pending approvals">
        <PendingApprovals refreshKey={n} />
      </Card>

      <Card title="Marketplace moderation">
        {products.data && !products.data.length && <Empty title="No listings" />}
        {!!products.data?.length && (
          <Table head={["Listing", "Seller", "Price", "Status", ""]} caption="Listings">
            {products.data.map((p) => (
              <tr key={p.id}>
                <Td>
                  {p.title} <SimTag kind="Demo" />
                </Td>
                <Td>{p.seller_name}</Td>
                <Td mono>{money(p.packaging[0].price_kobo)}</Td>
                <Td>
                  <Badge tone={p.status === "live" ? "ok" : "warn"}>{p.status}</Badge>
                </Td>
                <Td>
                  <Button disabled={!isAdmin} busy={busy === p.id} onClick={() => run(p.id, () => postJson(`/api/market/products/${encodeURIComponent(p.id)}`, { status: p.status === "live" ? "hidden" : "live" }, "PATCH"), "Listing moderated.")}>
                    {p.status === "live" ? "Hide" : "Approve and publish"}
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Alarm definitions">
        <Table head={["Alarm", "Tag", "Priority", "Set", "Clear", "Source"]} caption="Alarm definitions">
          {ALARM_DEFS.map((a) => (
            <tr key={a.id}>
              <Td mono>{a.id}</Td>
              <Td mono>{a.tag}</Td>
              <Td>{a.pri}</Td>
              <Td mono>{a.set}</Td>
              <Td mono>{a.clear}</Td>
              <Td>{a.src}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Tag list (ISA-5.1)" actions={<UserCog aria-hidden className="h-4 w-4 text-muted" />}>
        <Table head={["Tag", "Name", "Unit", "Range", "Limits", "Source"]} caption="Tag list">
          {TAGS.map((t) => (
            <tr key={t.id}>
              <Td mono>{t.id}</Td>
              <Td>{t.name}</Td>
              <Td>{t.unit}</Td>
              <Td mono>
                {t.min} to {t.max}
              </Td>
              <Td mono>{[t.lo !== undefined && `L ${t.lo}`, t.hi !== undefined && `H ${t.hi}`, t.hihi !== undefined && `HH ${t.hihi}`].filter(Boolean).join(" · ") || "-"}</Td>
              <Td>{t.source === "board" ? <Badge tone="ok">Board</Badge> : <SimTag />}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <OverrideRequestModal spec={spec} onClose={() => setSpec(null)} onDone={() => setN((x) => x + 1)} />
    </Page>
  );
}
