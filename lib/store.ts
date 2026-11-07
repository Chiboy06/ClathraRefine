"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ConcUnit, Currency } from "./format";
import type { CartLine } from "./cart";

export type Theme = "night" | "day";
export type Mode = "LIVE" | "DEMO";

type Prefs = {
  unit: ConcUnit;
  currency: Currency;
  theme: Theme;
  mode: Mode;
  rate: number;
  setUnit: (u: ConcUnit) => void;
  setCurrency: (c: Currency) => void;
  setTheme: (t: Theme) => void;
  setMode: (m: Mode) => void;
  setRate: (r: number) => void;
};

// shortcut: preferences persist per browser in localStorage, not per account; move to Clerk unsafeMetadata if users share machines.
export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      unit: "PCT",
      currency: "NGN",
      theme: "night",
      mode: "DEMO",
      rate: 1450,
      setUnit: (unit) => set({ unit }),
      setCurrency: (currency) => set({ currency }),
      setTheme: (theme) => set({ theme }),
      setMode: (mode) => set({ mode }),
      setRate: (rate) => set({ rate }),
    }),
    { name: "clathra-prefs", partialize: ({ unit, currency, theme, mode }) => ({ unit, currency, theme, mode }) },
  ),
);

type Cart = {
  lines: CartLine[];
  location: string;
  logistics: "pickup" | "tanker";
  open: boolean;
  add: (l: CartLine) => void;
  setQty: (i: number, qty: number) => void;
  remove: (i: number) => void;
  clear: () => void;
  setLocation: (l: string) => void;
  setLogistics: (l: "pickup" | "tanker") => void;
  setOpen: (o: boolean) => void;
};

export const useCart = create<Cart>()(
  persist(
    (set) => ({
      lines: [],
      location: "Port Harcourt Terminal",
      logistics: "pickup",
      open: false,
      add: (l) =>
        set((s) => {
          const i = s.lines.findIndex((x) => x.productId === l.productId && x.packagingId === l.packagingId);
          if (i < 0) return { lines: [...s.lines, l], open: true };
          const lines = [...s.lines];
          lines[i] = { ...lines[i], qty: lines[i].qty + l.qty };
          return { lines, open: true };
        }),
      setQty: (i, qty) => set((s) => ({ lines: s.lines.map((l, j) => (j === i ? { ...l, qty } : l)) })),
      remove: (i) => set((s) => ({ lines: s.lines.filter((_, j) => j !== i) })),
      clear: () => set({ lines: [] }),
      setLocation: (location) => set({ location }),
      setLogistics: (logistics) => set({ logistics }),
      setOpen: (open) => set({ open }),
    }),
    { name: "clathra-cart", partialize: ({ lines, location, logistics }) => ({ lines, location, logistics }) },
  ),
);
