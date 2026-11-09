import { ConvexReactClient } from "convex/react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
/** One Convex client for the app. Null without a deployment, so DEMO and tests run without it. */
export const convex = typeof window !== "undefined" && url ? new ConvexReactClient(url) : null;
