// Append-only hash chain: each entry's SHA-256 covers the previous hash and its own body.
// Used by the audit log and the carbon credit provenance ledger.

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stable JSON so the same body always hashes the same. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}

export const chainHash = (prev: string, body: unknown) => sha256Hex(prev + canonical(body));

export async function verifyChain(entries: { prev: string; hash: string; body: unknown }[]): Promise<boolean> {
  // The chain must start at GENESIS, otherwise deleting the oldest entries still verifies.
  if (entries.length && entries[0].prev !== "GENESIS") return false;
  let prev = "GENESIS";
  for (const e of entries) {
    if (e.prev !== prev || (await chainHash(prev, e.body)) !== e.hash) return false;
    prev = e.hash;
  }
  return true;
}
