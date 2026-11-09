"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { create } from "zustand";
import { api } from "@/convex/_generated/api";
import { convex } from "@/lib/convexClient";
import { useMe } from "./me";
import { cx } from "./ui";
import { getHub, type Snapshot } from "@/lib/telemetry/hub";
import { usePlant } from "@/lib/telemetry/usePlant";
import { plantView, sensorsHealth, solventOutlook } from "@/lib/plantView";
import { sessionAnomalyZ } from "@/lib/predict";
import { ppmFromMv } from "@/lib/mq135";
import { briefing, predictionMessage, ruleAnswer, runTool, solventMessage, type AssistantData } from "@/lib/assistantTools";
import { formatTime } from "@/lib/format";

export type Msg = { id: number; role: "user" | "assistant"; text: string; at: number; source?: "gemini" | "rules"; kind?: "alert" | "briefing" };

type Store = { msgs: Msg[]; open: boolean; unread: number; busy: boolean; push: (m: Omit<Msg, "id" | "at">) => void; setOpen: (o: boolean) => void; setBusy: (b: boolean) => void };
let nextId = 1;
/** One conversation shared by the launcher and the AI page. */
export const useAssistant = create<Store>((set) => ({
  msgs: [],
  open: false,
  unread: 0,
  busy: false,
  push: (m) => set((s) => ({ msgs: [...s.msgs, { ...m, id: nextId++, at: Date.now() }].slice(-100), unread: s.open || m.role === "user" ? s.unread : s.unread + 1 })),
  setOpen: (open) => set((s) => ({ open, unread: open ? 0 : s.unread })),
  setBusy: (busy) => set({ busy }),
}));

/** Tool data from what the operator sees: the same hub snapshot, in both data modes. */
export function assistantData(snap: Snapshot): AssistantData {
  const hub = getHub();
  const view = plantView(snap, hub.demoForecast(30));
  const solvent = solventOutlook(snap);
  const pick: Record<string, (h: Snapshot["history"][number]) => number | undefined> = {
    co2_in: (h) => (h.co2_in_mv === undefined ? undefined : ppmFromMv(h.co2_in_mv) ?? undefined),
    co2_out: (h) => (h.co2_out_mv === undefined ? undefined : ppmFromMv(h.co2_out_mv) ?? undefined),
    reduction: (h) => {
      const i = h.co2_in_mv === undefined ? null : ppmFromMv(h.co2_in_mv);
      const o = h.co2_out_mv === undefined ? null : ppmFromMv(h.co2_out_mv);
      return i && o !== null ? +(((i - o) / i) * 100).toFixed(1) : undefined;
    },
    ambient: (h) => h.ambient_mv,
    exhaust: (h) => h.exhaust_mv,
    gas_flow: (h) => h.gas_lpm,
    liquid_flow: (h) => h.liquid_lpm,
    solvent_temp: (h) => h.solvent_c,
    ph: (h) => h.ph,
  };
  return {
    view,
    trend: (tag, rangeMs) => {
      const f = pick[tag];
      if (!f) return [];
      return snap.history.filter((h) => h.receivedAt >= snap.now - rangeMs).flatMap((h) => (f(h) === undefined ? [] : [{ t: h.receivedAt, v: f(h)! }]));
    },
    alarms: snap.alarms.filter((a) => a.state !== "NORMAL").map((a) => ({ tag: a.tag, priority: a.priority, message: a.message, state: a.state, since: a.since })),
    events: snap.events,
    anomalyZ: sessionAnomalyZ(snap.history.map((h) => h.ambient_mv)),
    health: sensorsHealth(snap),
    solvent: { minutes: solvent.minutes, loadingPct: snap.solventLoadingPct, ratioNow: solvent.now },
  };
}

type Content = { role: "user" | "model"; parts: Record<string, unknown>[] };

/** Asks Gemini (through Convex, key stays on the server) with tools run here; falls back to rules if unavailable. */
async function answer(question: string, signedInWithClerk: boolean): Promise<{ text: string; source: "gemini" | "rules" }> {
  const d = assistantData(getHub().getSnapshot());
  if (convex && signedInWithClerk) {
    try {
      const contents: Content[] = [{ role: "user", parts: [{ text: question }] }];
      for (let i = 0; i < 4; i++) {
        const r = await Promise.race([
          convex.action(api.assistant.step, { contents }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 15_000)),
        ]);
        if (r.text) return { text: r.text, source: "gemini" };
        if (!r.calls?.length) break;
        contents.push({ role: "model", parts: r.calls.map((c) => ({ functionCall: { name: c.name, args: c.args } })) });
        contents.push({ role: "user", parts: r.calls.map((c) => ({ functionResponse: { name: c.name, response: { result: runTool(c.name, c.args as Record<string, unknown>, d) } } })) });
      }
    } catch {
      // free-tier limits or no key: fall through to the rule-based answer, never block the console
    }
  }
  return { text: ruleAnswer(question, d), source: "rules" };
}

export async function ask(question: string) {
  const s = useAssistant.getState();
  const q = question.trim();
  if (!q || s.busy) return;
  s.push({ role: "user", text: q });
  s.setBusy(true);
  const me = await fetch("/api/me").then((r) => r.json()).catch(() => null);
  const r = await answer(q, me?.auth === "clerk" && !!me?.session);
  useAssistant.getState().push({ role: "assistant", text: r.text, source: r.source });
  useAssistant.getState().setBusy(false);
}

/** Proactive alerts on alarms, predicted crossings, sensor health and solvent, plus a briefing every 15 minutes. */
function useProactive() {
  const p = usePlant();
  const seen = useRef<{ events: Set<string>; crit: boolean; health: string; solvent: boolean; briefedAt: number }>({ events: new Set(), crit: false, health: "", solvent: false, briefedAt: 0 });
  useEffect(() => {
    if (!p.ready || !p.latest) return;
    const push = useAssistant.getState().push;
    const s = seen.current;
    const d = assistantData(getHub().getSnapshot());
    if (!s.events.size) p.events.forEach((e) => s.events.add(e.id)); // do not replay history on load
    for (const e of p.events.slice(0, 5).reverse()) {
      if (s.events.has(e.id)) continue;
      s.events.add(e.id);
      if (e.severity === "CRITICAL" || e.severity === "WARNING") {
        const todo = e.severity === "CRITICAL" ? "Follow the trip walk-through: ventilate, keep people clear, press ACK on the board when readings are normal." : "Check the area around the sensor and watch the forecast.";
        push({ role: "assistant", kind: "alert", source: "rules", text: `${e.severity === "CRITICAL" ? "Critical" : "Warning"} at ${formatTime(e.at)}: ${e.message}. ${todo}` });
      }
    }
    const crit = !!d.view.critIn && d.view.critIn > 0;
    if (crit && !s.crit) push({ role: "assistant", kind: "alert", source: "rules", text: predictionMessage(d) });
    s.crit = crit;
    const bad = d.health.filter((h) => h.health.status !== "OK").map((h) => `${h.id}: ${h.health.status}`).join(", ");
    if (bad && bad !== s.health) push({ role: "assistant", kind: "alert", source: "rules", text: `Sensor health: ${bad}. ${d.health.find((h) => h.health.status !== "OK")?.health.evidence}.` });
    s.health = bad;
    const low = d.solvent.minutes !== null && d.solvent.minutes < 30;
    if (low && !s.solvent) push({ role: "assistant", kind: "alert", source: "rules", text: solventMessage(d) });
    s.solvent = low;
    if (p.now - s.briefedAt >= 15 * 60_000) {
      s.briefedAt = p.now;
      push({ role: "assistant", kind: "briefing", source: "rules", text: briefing(d) });
    }
  }, [p.ready, p.latest, p.events, p.now]);
}

export function Conversation({ compact }: { compact?: boolean }) {
  const { msgs, busy } = useAssistant();
  const [q, setQ] = useState("");
  const end = useRef<HTMLDivElement>(null);
  // Braces: scrollIntoView returns a Promise in newer browsers, and an effect must not return one.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);
  const quick = ["What is the outlet CO2 now?", "Why did the last alarm happen?", "Walk me through a trip", "How long until the solvent saturates?", "Brief me"];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="log" aria-label="Assistant conversation" aria-live="polite" className={cx("flex-1 space-y-3 overflow-y-auto", compact ? "p-4" : "py-2")}>
        {msgs.map((m) => (
          <div key={m.id} className={cx("max-w-[90%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm", m.role === "user" ? "ml-auto bg-primary text-white" : m.kind === "alert" ? "border border-warn/50 bg-warn-bg text-fg" : "bg-elev text-fg")} data-testid={m.role === "assistant" ? "assistant-msg" : undefined}>
            {m.text}
            <div className={cx("mt-1 text-[10px]", m.role === "user" ? "text-white/80" : "text-muted")}>
              {formatTime(m.at)}
              {m.role === "assistant" && ` · ${m.kind === "briefing" ? "Briefing" : m.kind === "alert" ? "Alert" : m.source === "gemini" ? "Gemini" : "Rules"} · advisory`}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm text-muted">Checking the plant data…</div>}
        <div ref={end} />
      </div>
      <div className={cx("flex flex-wrap gap-1.5", compact ? "px-4 pb-2" : "pb-2")}>
        {quick.map((x) => (
          <button key={x} onClick={() => ask(x)} className="rounded-full border border-line px-2.5 py-1 text-xs hover:bg-elev">
            {x}
          </button>
        ))}
      </div>
      <form
        className={cx("flex gap-2 border-t border-line", compact ? "p-3" : "pt-3")}
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
          setQ("");
        }}
      >
        <label htmlFor={compact ? "as-q" : "as-q-page"} className="sr-only">
          Ask about the plant
        </label>
        <input id={compact ? "as-q" : "as-q-page"} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about the plant" className="min-h-10 flex-1 rounded-lg border border-line bg-elev px-3 text-sm" />
        <button type="submit" aria-label="Send" disabled={busy} className="rounded-lg bg-primary px-3 text-white disabled:opacity-50">
          <Send aria-hidden className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

/** Bottom-right launcher, always visible. It never controls equipment. */
export function AssistantLauncher() {
  useProactive();
  const { open, unread, setOpen } = useAssistant();
  useMe();
  return (
    <>
      {open && (
        <section aria-label="AI assistant" className="fixed bottom-24 right-4 z-40 flex h-[min(32rem,70vh)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_24px_48px_-16px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Bot aria-hidden className="h-4 w-4" /> Plant assistant
            </h2>
            <button onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded p-1 text-muted hover:bg-elev">
              <X className="h-4 w-4" />
            </button>
          </div>
          <Conversation compact />
        </section>
      )}
      <button onClick={() => setOpen(!open)} aria-label={`${open ? "Close" : "Open"} assistant${unread ? `, ${unread} new` : ""}`} data-testid="assistant-launcher" className="fixed bottom-12 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary/90">
        <Bot aria-hidden className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-crit px-1.5 text-[10px] font-bold">{unread}</span>}
      </button>
    </>
  );
}
