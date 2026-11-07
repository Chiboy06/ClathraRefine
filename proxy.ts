import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = [
  "/",
  "/pricing",
  "/marketplace",
  "/marketplace/p/(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/market/products(.*)",
  "/api/paystack/webhook",
  "/api/pdf/(.*)",
  "/api/ledger",
  "/api/settings",
  "/api/me",
  "/api/demo-login",
];
const isPublic = createRouteMatcher(PUBLIC);

const clerkOn = !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Without Clerk keys the demo cookie gates pages; every API route still checks the role itself.
function demoProxy(req: NextRequest) {
  if (isPublic(req) || req.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();
  if (!req.cookies.get("demo_user")) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export default clerkOn
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublic(req)) await auth.protect();
    })
  : demoProxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
