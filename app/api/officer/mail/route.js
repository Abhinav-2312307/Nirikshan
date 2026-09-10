import { NextResponse } from "next/server";
import { decodeSessionToken } from "../../../../src/server/services/authService";
import { 
  listOfficialMemos, 
  dispatchOfficialMemo 
} from "../../../../src/server/services/officerService";

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
    const memos = await listOfficialMemos(officer);
    return NextResponse.json({ memos });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const officer = getOfficerFromRequest(request);
    if (!officer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    if (!body.subject || !body.body) {
      return NextResponse.json({ error: "Subject and memo body are required" }, { status: 400 });
    }
    const memo = await dispatchOfficialMemo(officer, body);
    return NextResponse.json({ success: true, memo });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
