"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { Session } from "@/lib/server/auth";

type Me = { session: Session | null; auth: "clerk" | "demo" | "none"; aws: boolean; paystack: boolean };
let meState: Me | null = null;
let meLoaded = false;
let meLoading: Promise<void> | null = null;
let meRefreshing: Promise<void> | null = null;
let meGen = 0;
const meSubs = new Set<() => void>();
const publish = () => meSubs.forEach((f) => f());

/**
 * One shared request per page load. force re-reads after sign-in, sign-out or a role change;
 * a newer forced read wins over an older in-flight one so a stale response cannot overwrite it.
 */
function loadMe(force = false) {
  if (meLoading && !force) return meLoading;
  if (meLoaded && !force) return Promise.resolve();
  const gen = ++meGen;
  const p = fetch("/api/me", { cache: "no-store" })
    .then((r) => r.json())
    .then((d: Me) => {
      if (gen !== meGen) return;
      meState = d;
      meLoaded = true;
      publish();
    })
    .catch(() => {
      // Keep the last known state: a failed refresh must not sign the user out in the UI.
    })
    .finally(() => {
      if (meLoading === p) meLoading = null;
    });
  meLoading = p;
  return p;
}

/**
 * Re-read the session from the server. Call after sign-in/out before navigating.
 * Concurrent callers (one per subscribed component) share a single read.
 */
export function refreshMe() {
  if (meRefreshing) return meRefreshing;
  // Let any read already in flight settle first, then read again so the result reflects the new session.
  meRefreshing = (meLoading ?? Promise.resolve())
    .then(() => loadMe(true))
    .finally(() => {
      meRefreshing = null;
    });
  return meRefreshing;
}

const subscribeMe = (cb: () => void) => {
  meSubs.add(cb);
  void loadMe();
  return () => {
    meSubs.delete(cb);
  };
};

/** Current user and server capabilities, one shared request. Used only to show or hide controls; the server enforces. */
export function useMe() {
  const me = useSyncExternalStore(subscribeMe, () => meState, () => null);
  // Client-side sign-in/out does not reload the page, so follow Clerk's own auth events too.
  // window.Clerk, not useClerk: the hook throws on builds without Clerk keys (local demo and e2e).
  useEffect(() => {
    const c = (window as { Clerk?: { addListener?: (cb: () => void) => () => void } }).Clerk;
    const off = c?.addListener?.(() => void refreshMe());
    return () => off?.();
  }, []);
  return { me, loading: !me, reload: refreshMe };
}
