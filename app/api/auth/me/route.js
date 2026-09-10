import { NextResponse } from "next/server";
import { decodeSessionToken } from "../../../../src/server/services/authService";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const portal = searchParams.get("portal") || "officer";

  let token = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }

  if (!token) {
    const cookieName = portal === "officer" ? "nirikshan_officer_token" : "nirikshan_citizen_token";
    token = request.cookies.get(cookieName)?.value;
  }

  if (!token) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const session = decodeSessionToken(token);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({
    authenticated: true,
    user: session
  });
}
