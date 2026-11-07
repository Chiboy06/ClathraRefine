import "server-only";
import { chainHash } from "../chain";
import { list, newId, put } from "./db";
import type { Session } from "./auth";

export type AuditEntry = {
  id: string;
  created_at: number;
  actor: string;
  actor_name: string;
  role: string;
  action: string;
  target: string;
  outcome: "ok" | "refused" | "pending";
  detail?: string;
  prev: string;
  hash: string;
};

/** Append-only: entries are only ever put, never updated, and each hash covers the previous one. */
export async function audit(s: Pick<Session, "userId" | "name" | "role"> | null, action: string, target: string, outcome: AuditEntry["outcome"], detail?: string) {
  const created_at = Date.now();
  const [last] = await list<AuditEntry>("audit_log", 1);
  const prev = last?.hash ?? "GENESIS";
  const body = { created_at, actor: s?.userId ?? "system", actor_name: s?.name ?? "System", role: s?.role ?? "system", action, target, outcome, detail };
  // shortcut: two writes in the same instant can fork the chain; serialise through a single writer if that matters.
  const hash = await chainHash(prev, body);
  return put("audit_log", { id: newId(created_at), ...body, prev, hash });
}
