import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Container, CtaLink } from "@/components/site";

export const metadata: Metadata = {
  title: "Security and safety architecture",
  description: "Why the cloud can never override local safety in ClathraRefine: edge interlocks, two-person overrides, roles checked on the server, an append-only audit trail and certificate handling.",
  alternates: { canonical: "/security" },
};

const SECTIONS = [
  {
    h: "Safety lives on the controller",
    p: "Alarms, the latched trip, the siren, SCRAM and the fan and pump sequence run on the edge controller and never wait for the network. A task watchdog restarts the controller if a safety task hangs, and a sensor-data timeout trips the alarm.",
    points: ["The controller accepts only SCRAM and ping from the cloud", "A trip resets only with the physical acknowledge button, once readings are normal", "Prediction models are advisory and cannot actuate"],
  },
  {
    h: "People and permissions",
    p: "Seven roles (viewer, operator, supervisor, auditor, buyer, seller, admin) are checked on the server for every request. Anything that reduces safety needs a second, different supervisor.",
    points: ["Supervisor PIN compared on the server against a bcrypt hash, with a rate limit", "The database refuses an approval by the person who made the request", "Thirty-minute idle sign-out on app pages"],
  },
  {
    h: "A record nobody can quietly edit",
    p: "Every command, approval, role change, setting change, report publish and payment is appended to an audit trail. Each entry's SHA-256 covers the previous entry, so a changed record breaks the chain and shows.",
    points: ["Published audit reports locked with the SHA-256 of their PDF", "Carbon credit provenance on its own hash-chained ledger"],
  },
  {
    h: "Data protection and keys",
    p: "The web app holds no stored AWS keys: it assumes one narrow role through short-lived identity tokens. Devices connect with their own X.509 certificate over TLS on port 8883.",
    points: [
      "Device private keys never pass through the web app; only the public certificate and Amazon Root CA are served",
      "Telemetry kept 30 days in DynamoDB with an S3 archive in eu-west-1",
      "Content security policy, HSTS and other security headers on every response",
      "Payments marked paid only after a signed Paystack webhook and a verify call with a matching amount",
    ],
  },
];

export default function Security() {
  return (
    <>
      <Container className="py-14 md:py-20">
        <h1 className="max-w-4xl text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.03em] [text-wrap:balance]">The cloud can never override local safety</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">ClathraRefine is built so that losing the network, the cloud or the app never makes a plant less safe.</p>
      </Container>
      <section className="border-t border-line bg-panel py-16 md:py-20">
        <Container className="grid gap-14 md:grid-cols-2">
          {SECTIONS.map((s) => (
            <div key={s.h}>
              <h2 className="text-2xl font-semibold tracking-[-0.015em]">{s.h}</h2>
              <p className="mt-3 text-lg leading-relaxed text-muted">{s.p}</p>
              <ul className="mt-4 flex flex-col gap-2">
                {s.points.map((pt) => (
                  <li key={pt} className="flex gap-2">
                    <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-ok-fg" /> {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Container>
      </section>
      <Container className="flex flex-wrap items-center justify-between gap-6 py-16">
        <h2 className="text-2xl font-semibold tracking-[-0.015em]">Want the full architecture review?</h2>
        <CtaLink href="/contact">Book a demo</CtaLink>
      </Container>
    </>
  );
}
