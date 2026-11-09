"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { OctagonX, ShieldAlert, UserCheck, Users } from "lucide-react";
import { Badge, Button, cx, Empty, ErrorNote, Field, inputCls, LoadingPanel, Notice, postJson, Table, Td, useFetch } from "./ui";
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

const HOLD_MS = 1000;
const CONFIRM_WINDOW_MS = 4000;

/**
 * Master SCRAM, to industrial practice: one deliberate action. Press and hold for 1 s, or press once and
 * confirm in the same spot within 4 s. Any operator; no PIN, no second person. The trip resets only at the board.
 */
export function ScramButton() {
  const { me } = useMe();
  const mode = usePrefs((s) => s.mode);
  const p = usePlant();
  const allowed = can(me?.session?.role, "scram");
  const [phase, setPhase] = useState<"idle" | "holding" | "confirm" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedByHold = useRef(false);

  const fire = useCallback(async () => {
    if (armTimer.current) clearTimeout(armTimer.current);
    setPhase("sending");
    try {
      const r = await postJson<{ request_id: string }>("/api/scram", { mode, confirm: true });
      if (mode === "DEMO") getHub().scramDemo();
      getHub().addEvent({ severity: "AUDIT", source: "app", tag: "HS-001", message: `SCRAM requested (${mode}), request ${r.request_id}` });
      setPhase("sent");
      setTimeout(() => setPhase("idle"), 6000);
    } catch (e) {
      setErr((e as Error).message);
      setPhase("error");
      setTimeout(() => setPhase("idle"), 5000);
    }
  }, [mode]);

  const arm = useCallback(() => {
    setPhase("confirm");
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setPhase((ph) => (ph === "confirm" ? "idle" : ph)), CONFIRM_WINDOW_MS);
  }, []);

  // The command palette asks for SCRAM through an event: it arms the button so a person confirms it.
  useEffect(() => {
    const onOpen = () => allowed && arm();
    window.addEventListener("clathra:open-scram", onOpen);
    return () => window.removeEventListener("clathra:open-scram", onOpen);
  }, [allowed, arm]);

  const down = () => {
    if (!allowed || phase === "sending") return;
    firedByHold.current = false;
    if (phase === "confirm") return; // the click handler confirms
    setPhase("holding");
    holdTimer.current = setTimeout(() => {
      firedByHold.current = true;
      fire();
    }, HOLD_MS);
  };
  const up = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setPhase((ph) => (ph === "holding" ? "idle" : ph));
  };
  const click = () => {
    if (!allowed || firedByHold.current) return;
    if (phase === "confirm") fire();
    else if (phase === "idle" || phase === "holding") arm();
  };

  const label =
    phase === "holding" ? "Hold…" : phase === "confirm" ? "Confirm SCRAM" : phase === "sending" ? "Sending…" : phase === "sent" ? (p.latest?.scram ? "SCRAM confirmed" : "SCRAM sent") : phase === "error" ? "Refused" : "SCRAM";
  return (
    <div className="relative">
      <button
        type="button"
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onClick={click}
        onKeyDown={(e) => e.key === "Escape" && setPhase("idle")}
        disabled={!allowed}
        aria-label="Master SCRAM: press and hold 1 second, or press then confirm"
        title={allowed ? "Press and hold 1 s, or press then confirm" : "Your role cannot SCRAM (operator or above)"}
        data-testid="scram"
        className={cx(
          "relative inline-flex min-h-10 select-none items-center gap-2 overflow-hidden rounded-lg border px-3 text-sm font-bold text-white transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
          phase === "confirm" ? "border-crit bg-crit ring-4 ring-crit/40" : "border-crit bg-crit hover:bg-crit/90",
        )}
      >
        <span aria-hidden className={cx("absolute inset-y-0 left-0 bg-white/25", phase === "holding" ? "w-full transition-[width] duration-1000 ease-linear" : "w-0")} />
        <OctagonX aria-hidden className="relative h-4 w-4" />
        <span className="relative">{label}</span>
      </button>
      <span role="status" aria-live="assertive" className="sr-only">
        {phase === "confirm" ? "Press again to confirm SCRAM" : phase === "sent" ? "SCRAM sent and recorded in the audit log" : phase === "error" ? err : ""}
      </span>
      {phase === "error" && <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-crit/50 bg-panel p-3 text-xs text-crit-fg shadow-lg">{err}</div>}
    </div>
  );
}

export type OverrideSpec = { kind: "siren_mute" | "manual_extend" | "setting"; target: string; value: number; title: string; consequence: string };

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
  r.kind === "setting" ? `Changes the ${r.target} setting to ${r.value}.` : r.kind === "siren_mute" ? `Mutes the siren from the app for ${r.value} min while the hazard is active.` : `Keeps manual mode on for ${r.value} more min while the hazard is active.`;

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
