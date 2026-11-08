// Select-before-operate for fan and pump, to industrial practice: select, arm (10 s), execute, then confirm from telemetry.
export const ARM_MS = 10_000;
export const CONFIRM_MS = 15_000;

export type Equipment = "fan" | "pump";
export type Action = "on" | "off";
export type Sbo =
  | { phase: "idle" }
  | { phase: "selected"; eq: Equipment; note?: string }
  | { phase: "armed"; eq: Equipment; action: Action; armedAt: number }
  | { phase: "waiting"; eq: Equipment; action: Action; sentAt: number }
  | { phase: "confirmed"; eq: Equipment; action: Action }
  | { phase: "rejected"; eq: Equipment; action: Action; reason: string };

export type SboEvent =
  | { type: "select"; eq: Equipment }
  | { type: "arm"; action: Action; now: number }
  | { type: "execute"; now: number }
  | { type: "ack"; accepted: boolean; reason?: string }
  | { type: "state"; on: boolean } // relay state from telemetry for the selected equipment
  | { type: "tick"; now: number }
  | { type: "cancel" };

export function sbo(s: Sbo, e: SboEvent): Sbo {
  switch (e.type) {
    case "select":
      return { phase: "selected", eq: e.eq };
    case "cancel":
      return { phase: "idle" };
    case "arm":
      return s.phase === "selected" || s.phase === "confirmed" || s.phase === "rejected" ? { phase: "armed", eq: s.eq, action: e.action, armedAt: e.now } : s;
    case "execute":
      if (s.phase !== "armed") return s;
      if (e.now - s.armedAt > ARM_MS) return { phase: "selected", eq: s.eq, note: "Arm expired. Choose the action again." };
      return { phase: "waiting", eq: s.eq, action: s.action, sentAt: e.now };
    case "ack":
      if (s.phase !== "waiting") return s;
      return e.accepted ? s : { phase: "rejected", eq: s.eq, action: s.action, reason: e.reason || "Refused by the controller" };
    case "state":
      return s.phase === "waiting" && e.on === (s.action === "on") ? { phase: "confirmed", eq: s.eq, action: s.action } : s;
    case "tick":
      if (s.phase === "armed" && e.now - s.armedAt > ARM_MS) return { phase: "selected", eq: s.eq, note: "Arm expired. Choose the action again." };
      if (s.phase === "waiting" && e.now - s.sentAt > CONFIRM_MS) return { phase: "rejected", eq: s.eq, action: s.action, reason: "No confirmation from telemetry within 15 s" };
      return s;
  }
}
