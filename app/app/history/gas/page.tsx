"use client";
import { HistoryView } from "@/components/history";

export default function GasHistory() {
  return <HistoryView kind="gas" title="Gas safety" subtitle="Ambient and exhaust gas readings by period." />;
}
