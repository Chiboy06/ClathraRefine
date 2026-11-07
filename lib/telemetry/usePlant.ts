"use client";
import { useEffect, useSyncExternalStore } from "react";
import { EMPTY_SNAP, getHub } from "./hub";
import { usePrefs } from "../store";

const noop = () => () => {};

/** Pages read board and plant data through this hook. The hub picks the TelemetrySource for the data mode. */
export function usePlant() {
  const mode = usePrefs((s) => s.mode);
  const hub = typeof window === "undefined" ? null : getHub();
  useEffect(() => hub?.setMode(mode), [hub, mode]);
  const snap = useSyncExternalStore(hub?.subscribe ?? noop, hub?.getSnapshot ?? (() => EMPTY_SNAP), () => EMPTY_SNAP);
  return { ...snap, ready: snap.now > 0 };
}

export const hubActions = () => getHub();
