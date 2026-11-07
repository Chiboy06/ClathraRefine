import type { Role } from "./roleMatrix";

export type OverrideRequest = { request_id: string; requested_by: string; status: "pending" | "approved" | "rejected" };

/** The same rule the DynamoDB condition enforces: pending, approver is a supervisor or admin, and not the requester. */
export function approvalError(req: OverrideRequest | undefined, approverId: string, approverRole: Role): string | null {
  if (!req) return "Request not found";
  if (req.status !== "pending") return "Request is not pending";
  if (approverRole !== "supervisor" && approverRole !== "admin") return "Only a supervisor can approve";
  if (req.requested_by === approverId) return "A second, different supervisor must approve";
  return null;
}
