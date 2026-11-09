"use client";
import dynamic from "next/dynamic";
import { Page, Skeleton } from "@/components/ui";
import { usePlant } from "@/lib/telemetry/usePlant";
import { relayOn } from "@/lib/fsm";

// WebGL needs the browser; load the 3D model only on this page.
const Skid3D = dynamic(() => import("@/components/skid3d").then((m) => m.Skid3D), { ssr: false, loading: () => <Skeleton className="h-[520px]" /> });

export default function Plant3D() {
  const p = usePlant();
  const state = { fanOn: relayOn(p.relayMask, 1), pumpOn: relayOn(p.relayMask, 2), scrubbing: p.latest?.scrubber === "SCRUBBING", alarm: !!p.latest && p.latest.ambient_level !== "NORMAL" };
  return (
    <Page title="3D plant view" subtitle="Drag to orbit. Fan blades turn when on, the column glows while scrubbing, an alarmed sensor pulses red.">
      <Skid3D state={state} />
    </Page>
  );
}
