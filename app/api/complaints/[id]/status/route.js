import { NextResponse } from "next/server";
import { advanceComplaintStatus } from "../../../../../src/server/services/placeService";

export async function PATCH(request, context) {
  const params = await context.params;
  const id = params.id;
  const body = await request.json().catch(() => ({}));
  const requested = body.status;

  try {
    const updated = await advanceComplaintStatus(id, requested);
    return NextResponse.json(updated);
  } catch (error) {
    if (error.message === "not_found") return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    if (error.message === "invalid_status") return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    if (error.message === "terminal_status") return NextResponse.json({ error: "Already closed" }, { status: 400 });
    return NextResponse.json({ error: "Could not update complaint" }, { status: 500 });
  }
}
