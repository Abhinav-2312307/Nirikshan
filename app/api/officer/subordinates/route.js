import { NextResponse } from "next/server";
import { decodeSessionToken } from "../../../../src/server/services/authService";
import { 
  getSubordinatesDirectory, 
  assignSubordinateTask, 
  transferJuniorOfficer 
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
    const subordinates = await getSubordinatesDirectory(officer);
    return NextResponse.json({ subordinates });
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
    if (!body.assigned_to_id || !body.title) {
      return NextResponse.json({ error: "Subordinate ID and task title are required" }, { status: 400 });
    }
    const task = await assignSubordinateTask(officer, body);
    return NextResponse.json({ success: true, task });
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
    const { target_officer_id, new_ward_code, new_ward_name, new_city, reason } = body;
    if (!target_officer_id || !new_ward_code || !new_ward_name) {
      return NextResponse.json({ error: "target_officer_id and new ward details are required" }, { status: 400 });
    }
    const result = await transferJuniorOfficer(officer, { target_officer_id, new_ward_code, new_ward_name, new_city, reason });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
