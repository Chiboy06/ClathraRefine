import type { Metadata } from "next";
import { FileDown } from "lucide-react";
import { Container } from "@/components/site";

export const metadata: Metadata = {
  title: "Resources",
  description: "Technical library: controller wiring, solvent safety data, calibration templates and the role matrix.",
  alternates: { canonical: "/resources" },
};

const DOCS = [
  { doc: "wiring", title: "ESP32-S3 wiring schematics", p: "Pin map, divider maths and wiring notes for the edge controller harness." },
  { doc: "sds", title: "Solvent safety data", p: "Handling, first aid and disposal for the dilute sodium hydroxide solvent." },
  { doc: "ndir", title: "NDIR calibration curves (template)", p: "Calibration points to record when an infrared CO2 analyser is fitted." },
  { doc: "rbac", title: "Role and permission matrix", p: "What each of the seven roles can do, and how two-person approval works." },
];

export default function Resources() {
  return (
    <Container className="py-14 md:py-20">
      <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-tight tracking-[-0.03em]">Resources</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">The technical library from the support desk. Each document is generated as a PDF.</p>
      <ul className="mt-12 divide-y divide-line border-y border-line">
        {DOCS.map((d) => (
          <li key={d.doc}>
            <a href={`/api/pdf/library?doc=${d.doc}`} download={`${d.doc}.pdf`} className="group flex items-center justify-between gap-6 py-6">
              <span>
                <span className="block text-xl font-semibold tracking-[-0.01em]">{d.title}</span>
                <span className="mt-1 block text-muted">{d.p}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-primary-fg">
                <FileDown aria-hidden className="h-5 w-5" /> PDF
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Container>
  );
}
