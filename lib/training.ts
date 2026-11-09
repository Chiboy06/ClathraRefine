// Training scenario: a leak replayed through the firmware port, with decision points. Pure.
import { initialBoard, stepBoard } from "./fsm";
import { KNOWLEDGE } from "./assistantTools";

export type Frame = { s: number; ambient: number; level: string; trip: boolean; scram: boolean; silenced: boolean };

/** 70 s incident: build-up, warning, critical trip, ACK silence, clearing, ACK reset. ACK presses follow the trainee's correct answers. */
export function trainingFrames(): Frame[] {
  let b = initialBoard();
  const out: Frame[] = [];
  for (let s = 0; s <= 70; s += 2) {
    const amb = s < 10 ? 480 : s < 20 ? 480 + (s - 10) * 120 : s < 24 ? 1700 : s < 36 ? 2900 : s < 46 ? 2900 - (s - 36) * 230 : 600;
    b = stepBoard(b, { uptimeMs: 200_000 + s * 1000, exhaustMv: 900, ambientMv: amb, ackPressed: s === 30 || s === 56 });
    out.push({ s, ambient: amb, level: b.level, trip: b.tripLatched, scram: b.scram, silenced: b.sirenSilenced });
  }
  return out;
}

export type Decision = { at: number; question: string; options: string[]; correct: number; explain: string };

export const DECISIONS: Decision[] = [
  { at: 18, question: "Ambient gas is at Pre-hazard and rising. What do you do first?", options: ["Ventilate and look for the source", "Press ACK on the board", "Wait until it trips"], correct: 0, explain: KNOWLEDGE["walkthrough-warning"] },
  { at: 28, question: "The trip has latched and the siren is sounding. What now?", options: ["Reset the trip from the app", "Press ACK once to silence the siren, then ventilate", "Restart the controller"], correct: 1, explain: KNOWLEDGE["walkthrough-trip"] },
  { at: 54, question: "Readings are back to Normal but the trip is still latched. How is it reset?", options: ["It resets itself", "A supervisor approves a reset in the app", "Press ACK on the board"], correct: 2, explain: KNOWLEDGE["walkthrough-trip"] },
];
