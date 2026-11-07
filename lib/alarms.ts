// ISA-18.2 style alarm state machine. Software acknowledgement here never resets the board:
// the trip resets only with the physical ACK button once readings are NORMAL.

export type Priority = "critical" | "high" | "medium" | "low";
export type AlarmState = "NORMAL" | "UNACK_ACTIVE" | "ACK_ACTIVE" | "RTN_UNACK" | "SHELVED" | "SUPPRESSED";

export type Alarm = {
  id: string;
  tag: string;
  priority: Priority;
  message: string;
  state: AlarmState;
  active: boolean;
  since: number;
  peak: number;
  shelvedUntil?: number;
  shelveReason?: string;
  ackBy?: string;
  count: number; // activations, for chattering and top-10 stats
};

export type AlarmEvent =
  | { type: "condition"; active: boolean; value: number; now: number; suppressed?: boolean }
  | { type: "ack"; by: string }
  | { type: "shelve"; reason: string; until: number }
  | { type: "tick"; now: number; suppressed?: boolean };

export function newAlarm(id: string, tag: string, priority: Priority, message: string): Alarm {
  return { id, tag, priority, message, state: "NORMAL", active: false, since: 0, peak: 0, count: 0 };
}

export function alarmReduce(a: Alarm, e: AlarmEvent): Alarm {
  switch (e.type) {
    case "condition": {
      const n: Alarm = { ...a, active: e.active, peak: e.active ? Math.max(a.active ? a.peak : 0, e.value) : a.peak };
      const rising = e.active && !a.active;
      if (rising) {
        n.since = e.now;
        n.count = a.count + 1;
      }
      if (a.state === "SHELVED") return n;
      if (e.suppressed) return { ...n, state: e.active ? "SUPPRESSED" : "NORMAL" };
      if (e.active) {
        if (a.state === "NORMAL" || a.state === "RTN_UNACK" || a.state === "SUPPRESSED") n.state = "UNACK_ACTIVE";
      } else {
        if (a.state === "UNACK_ACTIVE") n.state = "RTN_UNACK";
        else if (a.state === "ACK_ACTIVE" || a.state === "SUPPRESSED") n.state = "NORMAL";
      }
      return n;
    }
    case "ack":
      if (a.state === "UNACK_ACTIVE") return { ...a, state: "ACK_ACTIVE", ackBy: e.by };
      if (a.state === "RTN_UNACK") return { ...a, state: "NORMAL", ackBy: e.by };
      return a;
    case "shelve":
      if (!e.reason.trim() || !(e.until > 0)) return a; // shelving needs a reason and an expiry
      return { ...a, state: "SHELVED", shelvedUntil: e.until, shelveReason: e.reason };
    case "tick":
      if (a.state === "SHELVED" && a.shelvedUntil !== undefined && e.now >= a.shelvedUntil) {
        return { ...a, state: a.active ? "UNACK_ACTIVE" : "NORMAL", shelvedUntil: undefined, shelveReason: undefined };
      }
      if (a.state === "SUPPRESSED" && !e.suppressed) return { ...a, state: a.active ? "UNACK_ACTIVE" : "NORMAL" };
      return a;
  }
}

export const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Highest-priority unacknowledged alarm and the count, for the header banner. */
export function bannerAlarm(alarms: Alarm[]) {
  const unack = alarms.filter((a) => a.state === "UNACK_ACTIVE" || a.state === "RTN_UNACK");
  unack.sort((x, y) => PRIORITY_RANK[x.priority] - PRIORITY_RANK[y.priority] || y.since - x.since);
  return { top: unack[0], count: unack.length };
}

/** Chattering: three or more activations within a minute (ISA-18.2 rule of thumb). */
export function isChattering(activationTimes: number[], now: number) {
  return activationTimes.filter((t) => now - t <= 60_000).length >= 3;
}
