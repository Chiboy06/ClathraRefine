// Role list and permissions. Shared by client (to hide buttons) and server (to enforce, lib/roles.ts).
export const ROLES = ["viewer", "operator", "supervisor", "auditor", "buyer", "seller", "admin"] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "read"
  | "scram"
  | "ack"
  | "request_override"
  | "approve_override"
  | "audit"
  | "buy"
  | "sell"
  | "admin";

const MATRIX: Record<Role, Permission[]> = {
  viewer: ["read"],
  operator: ["read", "scram", "ack", "request_override"],
  supervisor: ["read", "scram", "ack", "request_override", "approve_override"],
  auditor: ["read", "audit"],
  buyer: ["read", "buy"],
  seller: ["read", "sell", "buy"],
  admin: ["read", "scram", "ack", "request_override", "approve_override", "audit", "buy", "sell", "admin"],
};

export const can = (role: Role | undefined, p: Permission) => !!role && MATRIX[role].includes(p);
export const isRole = (r: unknown): r is Role => typeof r === "string" && (ROLES as readonly string[]).includes(r);
