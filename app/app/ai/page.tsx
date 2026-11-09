"use client";
import { Card, Page } from "@/components/ui";
import { Conversation, ask } from "@/components/assistant";

const WALKS = [
  { q: "Walk me through a warning", label: "Responding to a warning" },
  { q: "Walk me through a trip", label: "Responding to a trip" },
  { q: "How do I calibrate a sensor?", label: "Calibrating a sensor" },
  { q: "How do I replace the solvent?", label: "Replacing solvent" },
  { q: "Draft the shift report from the last hour of events. Why did each one happen?", label: "Draft the shift report" },
];

export default function Assistant() {
  return (
    <Page title="Assistant" subtitle="Ask about the plant. Answers come from live readings, with times. It never operates equipment.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
        <Card className="flex h-[min(40rem,70vh)] flex-col">
          <Conversation />
        </Card>
        <Card title="Walk-throughs" help="Step-by-step guidance. For a trip it ends with pressing ACK on the board when readings are normal.">
          <ul className="flex flex-col gap-2">
            {WALKS.map((w) => (
              <li key={w.label}>
                <button onClick={() => ask(w.q)} className="w-full rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-elev">
                  {w.label}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Page>
  );
}
