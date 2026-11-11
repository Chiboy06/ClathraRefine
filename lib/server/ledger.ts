import "server-only";
import { chainHash, sha256Hex, canonical } from "../chain";
import { list, newId, put } from "./db";

export type LedgerEntry = { id: string; created_at: number; body: Record<string, unknown>; prev: string; hash: string };

/** Provenance ledger for carbon tokens. Each entry's SHA-256 covers the previous entry and its telemetry batch hash. */
export async function appendLedger(body: Record<string, unknown>, at = Date.now()) {
  const [last] = await list<LedgerEntry>("ledger", 1);
  const prev = last?.hash ?? "GENESIS";
  const full = { ...body, at };
  return put("ledger", { id: newId(at), created_at: at, body: full, prev, hash: await chainHash(prev, full) });
}

/** Seeds issuance entries from simulated scrubber telemetry batches the first time the ledger is read. */
export async function ensureLedger() {
  const rows = await list<LedgerEntry>("ledger", 1);
  if (rows.length) return;
  const start = Date.UTC(2026, 9, 1);
  // Fixed ids and hashes: two concurrent first reads write the same four rows instead of forking the chain.
  let prev = "GENESIS";
  for (let w = 0; w < 4; w++) {
    const batch = Array.from({ length: 24 }, (_, h) => ({ h: w * 24 + h, kgh: +(184.2 + Math.sin(h / 3) * 6).toFixed(1) }));
    const tonnes = Math.round(batch.reduce((s, b) => s + b.kgh, 0) * 7 / 1000 / 2.4 * 10) / 10;
    const at = start + w * 7 * 86_400_000;
    const body = { type: "issue", lot_id: "LOT-CRB-2026-10", week: w + 1, tokens: tonnes, telemetry_batch_sha256: await sha256Hex(canonical(batch)), source_tag: "FQ-501", simulated: true, at };
    const hash = await chainHash(prev, body);
    await put("ledger", { id: `${at.toString().padStart(15, "0")}#seed-${w + 1}`, created_at: at, body, prev, hash });
    prev = hash;
  }
}
