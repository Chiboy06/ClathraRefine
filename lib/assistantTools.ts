// The plant assistant's tools, knowledge and rule-based fallback. Shared by the Convex action (declarations)
// and the browser (execution against the plant data the operator sees). The assistant never controls equipment.
import { formatTime, num } from "./format";
import type { PlantView } from "./plantView";

export const SYSTEM_PROMPT = `You are the ClathraRefine plant assistant for a gas-leak prevention and CO2 capture skid.
Rules:
- Answer only from tool results. Call tools for every fact. Never answer from memory.
- Cite the readings you used with their values, units and UTC times.
- Be short and plain: what happened, why it matters, what to do next. UK English.
- You never control equipment. You may recommend SCRAM and tell the operator to press the SCRAM button themselves.
- A latched trip resets only with the physical ACK button on the board once readings are normal.
- Predictions are advisory. Show CO2 readings as plain ppm and % Vol values.`;

type Schema = { type: "object"; properties: Record<string, unknown>; required?: string[] };
const tool = (name: string, description: string, parametersJsonSchema: Schema = { type: "object", properties: {} }) => ({ name, description, parametersJsonSchema });

export const TOOL_DECLARATIONS = [
  tool("getLatestReadings", "Latest plant readings with their time: CO2 inlet and outlet, reduction, capture, flows, solvent temperature and pH, ambient gas level, scrubber and relay states."),
  tool("getTrend", "Recent values of one signal over a range.", {
    type: "object",
    properties: { tag: { type: "string", enum: ["co2_in", "co2_out", "reduction", "ambient", "exhaust", "gas_flow", "liquid_flow", "solvent_temp", "ph"] }, range: { type: "string", enum: ["15m", "1h", "24h"] } },
    required: ["tag", "range"],
  }),
  tool("getActiveAlarms", "Alarms that are active or not yet acknowledged."),
  tool("getEvents", "Plant events in a time range.", { type: "object", properties: { range: { type: "string", enum: ["15m", "1h", "24h"] } }, required: ["range"] }),
  tool("getPrediction", "Hazard risk index, the 30 s forecast crossing times and anomaly score."),
  tool("getSensorHealth", "Health of each gas sensor: OK, Drifting: calibrate, or Suspect: check wiring, with evidence."),
  tool("getSolventForecast", "Solvent loading and the predicted time to 50% CO2 breakthrough."),
  tool("explainProcess", "Short explanations and step-by-step walk-throughs about the skid.", {
    type: "object",
    properties: { topic: { type: "string", enum: Object.keys(knowledgeTopics()) } },
    required: ["topic"],
  }),
];

function knowledgeTopics() {
  return {
    scrubber: "Gas detected at the exhaust starts the intake fan; the solvent pump follows 2.0 s later; both stop after a 5.0 s purge once the gas clears. CO2 is absorbed by 0.025 M sodium hydroxide in the packed column.",
    alarms: "Ambient MQ-2: warning from 1,410 mV (clears at 1,310 mV), critical trip from 2,710 mV (clears at 2,610 mV). A trip latches the red strobe and siren.",
    scram: "SCRAM stops the pump, keeps the fan running and latches red and siren. Any operator can trigger it with one held press. It resets only at the board with the ACK button once readings are normal.",
    "manual-mode": "Manual mode lets an operator start and stop the fan and pump. The board refuses it while tripped, in SCRAM, warming up or with exhaust gas present, and returns to automatic after 10 minutes without a command.",
    "walkthrough-warning": "1. Check the ambient reading and the forecast on Overview. 2. Ventilate the room and look for the source near the ambient sensor. 3. Keep people away from ignition sources. 4. If the forecast shows a trip in under 30 s, press and hold SCRAM. 5. Log what you found in the shift log.",
    "walkthrough-trip": "1. The board has latched the trip: red strobe and siren are on, the pump has stopped. 2. Press ACK once on the board to silence the siren. 3. Ventilate and remove the source. 4. Wait until the ambient level shows Normal. 5. Press ACK on the board when readings are normal to reset the trip. 6. Record the incident in the shift log.",
    "walkthrough-calibrate": "1. Move the sensor to fresh outdoor air, or ventilate the room well. 2. Wait for the 3-minute warm-up to finish. 3. Open Settings, then Sensors and calibration. 4. Press Calibrate in fresh air: it averages 60 s and stores R0 for 420 ppm. 5. Check the reading settles near 420 ppm.",
    "walkthrough-replace-solvent": "1. Switch the board to automatic and wait for the scrubber to be Idle. 2. Wear gloves and goggles. 3. Drain the loaded solvent into a labelled container. 4. Fill 2 L of fresh 0.025 M sodium hydroxide (pH about 12.4). 5. Record the change so loading restarts at 0%.",
  } as const;
}
export const KNOWLEDGE: Record<string, string> = knowledgeTopics();

export type AssistantData = {
  view: PlantView;
  trend: (tag: string, rangeMs: number) => { t: number; v: number }[];
  alarms: { tag: string; priority: string; message: string; state: string; since: number }[];
  events: { at: number; severity: string; tag: string; message: string }[];
  anomalyZ: number | null;
  health: { id: string; name: string; health: { status: string; evidence: string } }[];
  solvent: { minutes: number | null; loadingPct: number; ratioNow: number };
};

const RANGES: Record<string, number> = { "15m": 900_000, "1h": 3_600_000, "24h": 86_400_000 };
const t = (ms: number | null) => (ms ? formatTime(ms) : "no reading yet");

/** Runs a tool against the data on screen. Results are small JSON the model can cite. */
export function runTool(name: string, args: Record<string, unknown>, d: AssistantData): unknown {
  const v = d.view;
  switch (name) {
    case "getLatestReadings":
      return {
        time: t(v.at),
        co2_inlet_ppm: Math.round(v.co2InPpm.value),
        co2_outlet_ppm: Math.round(v.co2OutPpm.value),
        co2_reduction_pct: +v.reductionPct.value.toFixed(1),
        capture_g_per_min: +v.captureGMin.value.toFixed(4),
        captured_today_g: +v.capturedTodayG.value.toFixed(2),
        gas_flow_l_min: v.gasLpm.value,
        liquid_flow_l_min: v.liquidLpm.value,
        solvent_temp_c: v.solventC.value,
        solvent_ph: v.ph.value,
        ambient_level: v.ambient.level,
        ambient_mv: v.ambient.mv,
        scrubber: v.scrubber,
        control_mode: v.boardMode,
        fan: v.fanOn ? "on" : "off",
        pump: v.pumpOn ? "on" : "off",
        trip_latched: v.tripped,
        scram: v.scram,
        data_mode: v.mode,
      };
    case "getTrend": {
      const pts = d.trend(String(args.tag), RANGES[String(args.range)] ?? RANGES["15m"]);
      if (!pts.length) return { tag: args.tag, points: 0 };
      const vals = pts.map((p) => p.v);
      return { tag: args.tag, from: t(pts[0].t), to: t(pts[pts.length - 1].t), first: vals[0], last: vals[vals.length - 1], min: Math.min(...vals), max: Math.max(...vals), points: pts.length };
    }
    case "getActiveAlarms":
      return d.alarms.map((a) => ({ ...a, since: t(a.since) }));
    case "getEvents": {
      const from = Date.now() - (RANGES[String(args.range)] ?? RANGES["1h"]);
      return d.events.filter((e) => e.at >= from).slice(0, 20).map((e) => ({ ...e, at: t(e.at) }));
    }
    case "getPrediction":
      return { risk_index: v.risk, warning_crossing_s: v.warnIn, trip_crossing_s: v.critIn, anomaly_score: d.anomalyZ === null ? null : +d.anomalyZ.toFixed(1), time: t(v.at), advisory: true };
    case "getSensorHealth":
      return d.health.map((h) => ({ sensor: `${h.id} ${h.name}`, status: h.health.status, evidence: h.health.evidence }));
    case "getSolventForecast":
      return { loading_pct: +d.solvent.loadingPct.toFixed(1), breakthrough_ratio: +d.solvent.ratioNow.toFixed(2), minutes_to_50pct_breakthrough: d.solvent.minutes };
    case "explainProcess":
      return { topic: args.topic, text: KNOWLEDGE[String(args.topic)] ?? "No notes on that topic." };
    default:
      return { error: `Unknown tool ${name}` };
  }
}

/** Rule-based answers used when Gemini is unavailable. Same tools, same citations. */
export function ruleAnswer(question: string, d: AssistantData): string {
  const q = question.toLowerCase();
  const v = d.view;
  const at = `(${t(v.at)})`;
  const walk = (k: string) => KNOWLEDGE[k].split(/ (?=\d\. )/).join("\n");
  if (/calibrat/.test(q)) return `Calibrating a sensor:\n${walk("walkthrough-calibrate")}`;
  if (/replace|change.*solvent|new solvent/.test(q)) return `Replacing the solvent:\n${walk("walkthrough-replace-solvent")}`;
  if (/trip|reset/.test(q)) return `Responding to a trip:\n${walk("walkthrough-trip")}`;
  if (/warning|what (should|do) i do/.test(q)) return `Responding to a warning:\n${walk("walkthrough-warning")}`;
  if (/outlet/.test(q)) return `Outlet CO2 is ${num(v.co2OutPpm.value)} ppm (${num(v.co2OutPpm.value / 10_000, 2)}% Vol) ${at}.`;
  if (/inlet/.test(q)) return `Inlet CO2 is ${num(v.co2InPpm.value)} ppm (${num(v.co2InPpm.value / 10_000, 2)}% Vol) ${at}.`;
  if (/reduction|efficien/.test(q)) return `CO2 reduction is ${num(v.reductionPct.value, 1)}%: inlet ${num(v.co2InPpm.value)} ppm, outlet ${num(v.co2OutPpm.value)} ppm ${at}.`;
  if (/captur/.test(q)) return `Capturing ${num(v.captureGMin.value * 60, 2)} g/h now; ${num(v.capturedTodayG.value, 2)} g captured today ${at}.`;
  if (/solvent|saturat|breakthrough/.test(q)) return solventMessage(d);
  if (/alarm/.test(q)) return d.alarms.length ? `Active alarms: ${d.alarms.map((a) => `${a.priority} ${a.tag} ${a.message} since ${t(a.since)}`).join("; ")}.` : `No active alarms ${at}.`;
  if (/risk|predict|forecast|leak/.test(q)) return predictionMessage(d);
  if (/sensor|health|drift|wiring/.test(q)) return d.health.map((h) => `${h.id} ${h.name}: ${h.health.status} (${h.health.evidence})`).join("\n");
  if (/flow/.test(q)) return `Gas flow ${num(v.gasLpm.value, 2)} L/min, solvent flow ${num(v.liquidLpm.value, 2)} L/min ${at}.`;
  if (/temp|ph/.test(q)) return `Solvent ${num(v.solventC.value, 1)} °C, pH ${num(v.ph.value, 2)} ${at}.`;
  if (/scram/.test(q)) return `${KNOWLEDGE.scram} I cannot press it for you.`;
  if (/why/.test(q)) {
    const recent = d.events.slice(0, 4).map((e) => `${t(e.at)} ${e.tag}: ${e.message}`).join("\n");
    return recent ? `The most recent events, newest first:\n${recent}` : "No recent events explain it yet.";
  }
  return briefing(d);
}

export function predictionMessage(d: AssistantData) {
  const v = d.view;
  if (v.critIn) return `Hazard risk ${v.risk}/100. The 30 s forecast reaches the trip threshold in about ${v.critIn} s (${t(v.at)}). Ventilate now; if it keeps rising, press and hold SCRAM. Advisory: the controller acts on its own limits.`;
  if (v.warnIn) return `Hazard risk ${v.risk}/100. The forecast reaches the warning threshold in about ${v.warnIn} s (${t(v.at)}). Check the ambient area for a source.`;
  return `Hazard risk ${v.risk}/100. No threshold crossing in the next 30 s (${t(v.at)}).`;
}

export function solventMessage(d: AssistantData) {
  const s = d.solvent;
  const when = s.minutes === null ? "Breakthrough is not rising yet." : s.minutes === 0 ? "The solvent is saturated: outlet is at half the inlet or more." : `Solvent saturated in about ${s.minutes} min at this rate.`;
  return `Solvent loading ${num(s.loadingPct, 0)}%, breakthrough ${num(s.ratioNow * 100, 0)}%. ${when}${s.minutes !== null && s.minutes < 30 ? " Plan a solvent change." : ""}`;
}

/** 15-minute briefing: what changed, what is predicted, what to do. */
export function briefing(d: AssistantData): string {
  const v = d.view;
  const lastHour = d.events.filter((e) => e.at >= Date.now() - 3_600_000);
  const notable = lastHour.filter((e) => e.severity === "CRITICAL" || e.severity === "WARNING");
  const changed = notable.length ? `${notable.length} warning or critical event${notable.length > 1 ? "s" : ""} in the last hour, latest: ${notable[0].message} at ${t(notable[0].at)}.` : "No warnings in the last hour.";
  const todo = v.tripped ? "Trip latched: follow the trip walk-through and reset at the board once readings are normal." : v.critIn ? "Ventilate now and be ready to SCRAM." : d.solvent.minutes !== null && d.solvent.minutes < 30 ? "Plan a solvent change." : d.health.some((h) => h.health.status !== "OK") ? "Check the sensor flagged in Sensor health." : "No action needed.";
  return `Briefing ${t(v.at)}. CO2 ${num(v.co2InPpm.value)} ppm in, ${num(v.co2OutPpm.value)} ppm out, ${num(v.reductionPct.value, 1)}% reduction; ${num(v.capturedTodayG.value, 2)} g captured today. ${changed} ${predictionMessage(d).split(". ").slice(0, 2).join(". ")}. ${todo}`;
}
