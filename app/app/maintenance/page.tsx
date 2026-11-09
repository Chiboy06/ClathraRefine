"use client";
import Link from "next/link";
import Device from "../devices/[thing]/page";

const params = Promise.resolve({ thing: "ESP32S3-N16R8-HARNESS-01" });

/** Device health for the skid controller; the per-device page keeps working for other things. */
export default function Maintenance() {
  return (
    <>
      <Device params={params} />
      <p className="mx-auto max-w-7xl px-6 pb-8 text-sm text-muted md:px-8 lg:px-10">
        See also{" "}
        <Link href="/app/ai/sensor-health" className="font-semibold text-primary-fg hover:underline">
          sensor health
        </Link>{" "}
        and the{" "}
        <Link href="/app/audit-history" className="font-semibold text-primary-fg hover:underline">
          audit history
        </Link>
        .
      </p>
    </>
  );
}
