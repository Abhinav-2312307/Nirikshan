import { NextResponse } from "next/server";
import { decodeSessionToken } from "../../../../src/server/services/authService";
import { 
  listFundRequests, 
  createFundRequest, 
  updateFundRequestStatus 
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
    const funds = await listFundRequests(officer);
    return NextResponse.json({ funds });
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
    const newFund = await createFundRequest(officer, body);
    return NextResponse.json({ success: true, fund: newFund });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const officer = getOfficerFromRequest(request);
    if (!officer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const { fund_id, action, remarks, approved_amount } = body;
    if (!fund_id || !action) {
      return NextResponse.json({ error: "fund_id and action are required" }, { status: 400 });
    }
    const result = await updateFundRequestStatus(officer, fund_id, { action, remarks, approved_amount });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
