"use client";
import { useState } from "react";
import { OctagonX, ShieldAlert, UserCheck, Users } from "lucide-react";
import { Badge, Button, Empty, ErrorNote, Field, inputCls, LoadingPanel, Notice, postJson, Table, Td, useFetch } from "./ui";
import { Modal, Mono, useMe } from "./scada";
import { usePrefs } from "@/lib/store";
import { can } from "@/lib/roleMatrix";
import { getHub } from "@/lib/telemetry/hub";
import { usePlant } from "@/lib/telemetry/usePlant";
import { formatDateTime } from "@/lib/format";

function Initiator() {
  const { me } = useMe();
  const { now } = usePlant();
  const s = me?.session;
  return (
    <div className="rounded-md border border-line bg-elev p-4 text-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Initiator</div>
      {s ? (
        <div>
          <span className="font-semibold">{s.name}</span> · role <Mono>{s.role}</Mono> · {now ? formatDateTime(now) : ""}
        </div>
      ) : (
        <div>Not signed in</div>
      )}
    </div>
  );
}

/** Master SCRAM: one confirmed click for an operator or above. The trip resets only at the board. */
export function ScramButton({ compact }: { compact?: boolean }) {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const allowed = can(me?.session?.role, "scram");
  return (
    <>
      <Button
        variant="danger"
        onClick={() => setOpen(true)}
        disabled={!allowed}
        title={allowed ? "Master SCRAM" : "Your role cannot SCRAM (operator or above)"}
        aria-label="Master SCRAM"
        className={compact ? "px-3" : ""}
      >
        <OctagonX aria-hidden className="h-4 w-4" />
        {compact ? "SCRAM" : "Master SCRAM"}
      </Button>
      <ScramModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ScramModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mode = usePrefs((s) => s.mode);
  const p = usePlant();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await postJson<{ request_id: string }>("/api/scram", { mode, confirm: true });
      if (mode === "DEMO") getHub().scramDemo();
      getHub().addEvent({ severity: "AUDIT", source: "app", tag: "HS-001", message: `SCRAM requested (${mode}), request ${r.request_id}` });
      setSent(r.request_id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    setConfirm(false);
    setSent(null);
    setErr("");
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title="Master SCRAM">
      <div className="flex flex-col gap-4">
        <Initiator />
        <Notice tone="crit">
          <strong>Consequence:</strong> the board stops the solvent pump, keeps the extraction fan running, and latches the red strobe and siren.
          {mode === "LIVE" ? " The command goes to the real board through AWS IoT Core." : " DEMO mode: this acts on the simulated plant only."} The trip resets only with the physical ACK button once readings are NORMAL.
        </Notice>
        <Notice tone="neutral">SCRAM is a safe action, so it needs one confirmed operator. Overrides that reduce safety need a second supervisor.</Notice>
        {sent ? (
          <Notice tone={p.latest?.scram ? "ok" : "warn"}>
            Request <Mono>{sent}</Mono> recorded in the audit log.{" "}
            {p.latest?.scram ? "Confirmed by board telemetry: scram true, trip latched." : "Waiting for board telemetry to confirm scram: true…"}
          </Notice>
        ) : (
          <>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 h-4 w-4" />I understand the consequence and want to SCRAM the plant now.
            </label>
            {err && <ErrorNote>{err}</ErrorNote>}
            <Button variant="danger" disabled={!confirm} busy={busy} onClick={submit}>
              <OctagonX aria-hidden className="h-4 w-4" /> Confirm SCRAM
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

export type OverrideSpec = { kind: "relay_override" | "pulse_test" | "manual_mode" | "setting"; target: string; value: number; title: string; consequence: string };

/** Step 1 of the two-person rule: the initiator records the request. Nothing acts until another supervisor approves. */
export function OverrideRequestModal({ spec, onClose, onDone }: { spec: OverrideSpec | null; onClose: () => void; onDone?: () => void }) {
  const mode = usePrefs((s) => s.mode);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const close = () => {
    setReason("");
    setConfirm(false);
    setErr("");
    setDone(null);
    onClose();
  };
  const submit = async () => {
    if (!spec) return;
    setBusy(true);
    setErr("");
    try {
      const r = await postJson<{ id: string }>("/api/overrides", { kind: spec.kind, target: spec.target, value: spec.value, reason, mode, confirm: true });
      setDone(r.id);
      getHub().addEvent({ severity: "AUDIT", source: "app", tag: "HS-001", message: `${spec.title} requested, awaiting second supervisor` });
      onDone?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={!!spec} onClose={close} title={spec?.title ?? ""}>
      {spec && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge tone="primary">
              <Users aria-hidden className="h-3.5 w-3.5" /> Two-Person Security
            </Badge>
            <Badge tone={mode === "LIVE" ? "crit" : "warn"}>{mode}</Badge>
          </div>
          <Initiator />
          <Notice tone="warn">
            <strong>Consequence:</strong> {spec.consequence}
            {mode === "LIVE" && spec.kind !== "setting" && " In LIVE mode the firmware accepts SCRAM and ping only, so after approval this is recorded as requiring firmware support and nothing changes on the board."}
          </Notice>
          {done ? (
            <Notice tone="ok">
              Request <Mono>{done}</Mono> is pending. A second, different supervisor must approve it with the supervisor PIN in Pending approvals.
            </Notice>
          ) : (
            <>
              <Field id="ov-reason" label="Reason">
                <textarea id="ov-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputCls} />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 h-4 w-4" />I confirm this request and understand it needs a second supervisor.
              </label>
              {err && <ErrorNote>{err}</ErrorNote>}
              <Button variant="primary" disabled={!confirm || !reason.trim()} busy={busy} onClick={submit}>
                Submit for second supervisor
              </Button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

type Req = { id: string; kind: string; target: string; value: number; reason: string; mode: string; requested_by: string; requested_name: string; requested_role: string; created_at: number; status: string; approved_name?: string };

const consequenceOf = (r: Req) =>
  r.kind === "setting"
    ? `Changes the ${r.target} setting to ${r.value}.`
    : r.kind === "manual_mode"
      ? `Switches the relay deck to ${r.value === 1 ? "MANUAL OVERRIDE" : "AUTOMATIC"}.`
      : r.kind === "pulse_test"
        ? `Pulses relay ${r.target} for 1.5 s.`
        : `Forces relay ${r.target} ${r.value === 1 ? "ON" : "OFF"} for 60 s, overriding the edge FSM.`;

/** Step 2: a different supervisor approves with the PIN. The server checks the PIN hash and the different-user condition. */
function ApproveModal({ req, onClose, onDone }: { req: Req | null; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const close = () => {
    setPin("");
    setConfirm(false);
    setErr("");
    setResult(null);
    onClose();
  };
  const submit = async () => {
    if (!req) return;
    setBusy(true);
    setErr("");
    try {
      const r = await postJson<{ outcome: string }>(`/api/overrides/${encodeURIComponent(req.id)}/approve`, { pin, confirm: true });
      if (r.outcome === "simulated") getHub().applyOverride(req.kind, req.target, req.value);
      if (r.outcome === "applied" && req.target === "usd_ngn_rate") usePrefs.getState().setRate(req.value);
      setResult(r.outcome === "requires_firmware" ? "Approved: requires firmware support. The board accepts SCRAM and ping only, so nothing changed on the board." : r.outcome === "simulated" ? "Approved and applied to the DEMO scenario." : "Approved and applied.");
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setPin("");
    }
  };
  return (
    <Modal open={!!req} onClose={close} title="Supervisor approval">
      {req && (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-line bg-elev p-4 text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Initiator</div>
            <span className="font-semibold">{req.requested_name}</span> · role <Mono>{req.requested_role}</Mono> · {formatDateTime(req.created_at)} · <Badge tone={req.mode === "LIVE" ? "crit" : "warn"}>{req.mode}</Badge>
            <div className="mt-2 text-muted">Reason: {req.reason}</div>
          </div>
          <Notice tone="warn">
            <strong>Consequence:</strong> {consequenceOf(req)}
          </Notice>
          {result ? (
            <Notice tone="ok">{result}</Notice>
          ) : (
            <>
              <Field id="sup-pin" label="Supervisor PIN" hint="Checked on the server against a bcrypt hash. Limited to 5 tries a minute.">
                <input id="sup-pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className={inputCls} maxLength={12} />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 h-4 w-4" />I am a different supervisor from the initiator and I authorise this override.
              </label>
              {err && <ErrorNote>{err}</ErrorNote>}
              <Button variant="primary" disabled={!confirm || pin.length < 4} busy={busy} onClick={submit}>
                <UserCheck aria-hidden className="h-4 w-4" /> Authorize Override
              </Button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

export function PendingApprovals({ refreshKey = 0 }: { refreshKey?: number }) {
  const { me } = useMe();
  const r = useFetch<Req[]>("/api/overrides", [refreshKey]);
  const [sel, setSel] = useState<Req | null>(null);
  const canApprove = can(me?.session?.role, "approve_override");
  if (r.loading && !r.data) return <LoadingPanel />;
  if (r.error) return <ErrorNote>{r.error}</ErrorNote>;
  const rows = r.data ?? [];
  if (!rows.length) return <Empty title="No override requests yet" />;
  return (
    <>
      <Table head={["Requested", "Request", "Initiator", "Mode", "Status", ""]} caption="Override requests">
        {rows.slice(0, 15).map((q) => (
          <tr key={q.id}>
            <Td mono>{formatDateTime(q.created_at)}</Td>
            <Td>{consequenceOf(q)}</Td>
            <Td>{q.requested_name}</Td>
            <Td>
              <Badge tone={q.mode === "LIVE" ? "crit" : "warn"}>{q.mode}</Badge>
            </Td>
            <Td>
              {q.status === "pending" ? (
                <Badge tone="warn">Pending second supervisor</Badge>
              ) : (
                <Badge tone="ok">
                  Approved by {q.approved_name}
                  {q.mode === "LIVE" && q.kind !== "setting" ? ": requires firmware support" : ""}
                </Badge>
              )}
            </Td>
            <Td>
              {q.status === "pending" && canApprove && (
                <Button onClick={() => setSel(q)}>
                  <ShieldAlert aria-hidden className="h-4 w-4" /> Approve
                </Button>
              )}
            </Td>
          </tr>
        ))}
      </Table>
      <ApproveModal req={sel} onClose={() => setSel(null)} onDone={r.reload} />
    </>
  );
}
