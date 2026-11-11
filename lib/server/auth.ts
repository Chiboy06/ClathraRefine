import "server-only";
import { cookies } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isRole, type Role } from "../roleMatrix";
import { DEMO_USERS } from "../demoData";
import { get } from "./db";

export type Session = { userId: string; role: Role; name: string; email?: string; orgId?: string; demo: boolean };

export const clerkEnabled = () => !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
// Demo quick-login is refused whenever Clerk is configured, so it can never bypass real sign-in.
export const demoAuthEnabled = () => !clerkEnabled() && process.env.DEMO_AUTH === "true";

export async function getSession(): Promise<Session | null> {
  if (clerkEnabled()) {
    const { userId, sessionClaims, orgId: activeOrgId } = await auth();
    if (!userId) return null;
    const u = await currentUser();
    // The session token only carries public metadata when the Clerk session template adds it.
    // Fall back to the user record and the active organisation so roles and tenancy still resolve.
    const claims = sessionClaims?.metadata as { role?: unknown; orgId?: unknown } | undefined;
    const meta = u?.publicMetadata as { role?: unknown; orgId?: unknown } | undefined;
    const rawRole = claims?.role ?? meta?.role;
    const role = isRole(rawRole) ? rawRole : "viewer";
    const rawOrgId = claims?.orgId ?? meta?.orgId;
    const orgId = typeof rawOrgId === "string" ? rawOrgId : (activeOrgId ?? undefined);
    return {
      userId,
      role,
      orgId,
      name: [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || userId,
      email: u?.primaryEmailAddress?.emailAddress,
      demo: false,
    };
  }
  if (!demoAuthEnabled()) return null;
  const id = (await cookies()).get("demo_user")?.value;
  const u = DEMO_USERS.find((d) => d.id === id);
  if (!u) return null;
  const override = await get<{ role: string }>("user_roles", u.id);
  return { userId: u.id, role: isRole(override?.role) ? override.role : u.role, name: u.name, email: u.email, demo: true };
}
