import { FW } from "./process";

export const ALARM_DEFS = [
  { id: "ALM-AT101-HIHI", tag: "AT-101", pri: "critical", set: `≥ ${FW.AMB_CRIT_ON_MV} mV`, clear: `≤ ${FW.AMB_CRIT_OFF_MV} mV`, src: "Firmware level CRITICAL" },
  { id: "ALM-AT101-HI", tag: "AT-101", pri: "high", set: `≥ ${FW.AMB_WARN_ON_MV} mV`, clear: `≤ ${FW.AMB_WARN_OFF_MV} mV`, src: "Firmware level WARNING" },
  { id: "ALM-HS001", tag: "HS-001", pri: "critical", set: "scram = true", clear: "ACK at board", src: "Telemetry flag" },
  { id: "ALM-TRIP", tag: "XA-206", pri: "high", set: "trip_latched = true", clear: "ACK at board when NORMAL", src: "Telemetry flag" },
  { id: "ALM-SENSOR", tag: "AT-101", pri: "high", set: "sensor_fault or < 100 mV", clear: "Reading restored", src: "Telemetry flag" },
  { id: "ALM-STALE", tag: "HS-001", pri: "medium", set: "No reading for 10 s", clear: "Next reading", src: "Dashboard" },
];
