"use client";
import { useSyncExternalStore } from "react";
import type { Session } from "@/lib/server/auth";

type Me = { session: Session | null; auth: "clerk" | "demo" | "none"; aws: boolean; paystack: boolean };
let meState: Me | null = null;
let meLoading: Promise<void> | null = null;
const meSubs = new Set<() => void>();
function loadMe(force = false) {
  if (meLoading && !force) return;
  meLoading = fetch("/api/me", { cache: "no-store" })
    .then((r) => r.json())
    .then((d: Me) => {
      meState = d;
      meSubs.forEach((f) => f());
    })
    .catch(() => {
      meLoading = null;
    });
}
const subscribeMe = (cb: () => void) => {
  meSubs.add(cb);
  loadMe();
  return () => {
    meSubs.delete(cb);
  };
};
/** Current user and server capabilities, one shared request. Used only to show or hide controls; the server enforces. */
export function useMe() {
  const me = useSyncExternalStore(subscribeMe, () => meState, () => null);
  return { me, loading: !me, reload: () => loadMe(true) };
}

