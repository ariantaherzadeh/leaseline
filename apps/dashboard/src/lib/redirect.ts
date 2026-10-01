import { NextResponse } from "next/server";

/**
 * Redirect to a path on whatever host the browser is on. A relative Location keeps the user on
 * app.tryleaseline.com: on Netlify, `request.url` can carry the deploy's own address
 * (<id>--leaseline-app.netlify.app), where the session cookie doesn't exist, which sent people
 * who had just signed in straight back to the login page.
 */
export function redirectTo(pathWithQuery: string, status: 302 | 303 | 307 = 303): NextResponse {
  return new NextResponse(null, { status, headers: { Location: pathWithQuery } });
}
