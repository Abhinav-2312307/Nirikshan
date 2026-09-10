import { NextResponse } from "next/server";
import { decodeSessionToken } from "@/src/server/services/authService";
import { executeComplaintAction } from "@/src/server/services/officerService";

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

export async function POST(request, context) {
  try {
    const officer = getOfficerFromRequest(request);
    if (!officer) {
      return NextResponse.json({ error: "Unauthorized. Officer credentials required." }, { status: 401 });
    }

    const params = await context.params;
    const complaintId = params.id;
    const body = await request.json().catch(() => ({}));

    const result = await executeComplaintAction(complaintId, officer, body);
    return NextResponse.json({
      success: true,
      complaint: result
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
