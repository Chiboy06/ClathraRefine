import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

// The marketing site and API are public at this layer; every API route checks the role itself.
// Only the app needs a session, except browsing the marketplace.
const isApp = createRouteMatcher(["/app(.*)"]);
const isPublicApp = createRouteMatcher(["/app/marketplace", "/app/marketplace/p/(.*)"]);
const needsSession = (req: NextRequest) => isApp(req) && !isPublicApp(req);

const clerkOn = !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function demoProxy(req: NextRequest) {
  if (needsSession(req) && !req.cookies.get("demo_user")) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export default clerkOn
  ? clerkMiddleware(async (auth, req) => {
      if (needsSession(req)) await auth.protect();
    })
  : demoProxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
