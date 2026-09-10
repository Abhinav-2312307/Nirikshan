import { NextResponse } from "next/server";
import { decodeSessionToken } from "../../../../src/server/services/authService";
import { calculateJurisdictionScorecard } from "../../../../src/server/services/officerService";

function getOfficerFromRequest(request) {
  let token = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }
  if (!token) {
    token = request.cookies.get("nirikshan_officer_token")?.value;
  }
  if (!token) return null;
  const session = decodeSessionToken(token);
  return session?.role === "officer" ? session : null;
}

export async function GET(request) {
  try {
    const officer = getOfficerFromRequest(request);
    if (!officer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const scorecard = await calculateJurisdictionScorecard(officer);
    return NextResponse.json(scorecard);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
