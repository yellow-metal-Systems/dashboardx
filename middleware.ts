import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";

import { SESSION_COOKIE_NAME, sessionOptions, type StaffSession } from "@/lib/auth/session";

// First line of defence: no unauthenticated request reaches a /dashboard route.
//
// NOT the only line. A Next.js server action is a POST endpoint that can be
// invoked directly, so every action calls requireStaffOrThrow() as well. A
// middleware- or layout-only guard protects the page render and leaves the
// mutation open.
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Edge-safe: reads and verifies the signed cookie without touching the
  // database, so this adds no query to every navigation.
  const session = await getIronSession<StaffSession>(request, response, sessionOptions);

  if (!session.userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Bring them back to where they were trying to go after signing in.
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Only /dashboard/* is protected. /login must stay reachable, and the matcher
  // deliberately excludes static assets so they are not run through session
  // verification on every request.
  matcher: ["/dashboard/:path*"],
};

// A note on cookie size: iron-session stores the session encrypted IN the cookie,
// so there is no server-side session table to look up. That is why this works at
// the edge. Keep StaffSession small — it must stay well under the 4KB cookie
// limit.
