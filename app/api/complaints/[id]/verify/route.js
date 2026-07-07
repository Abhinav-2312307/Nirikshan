import { NextResponse } from "next/server";
import { verifyResolution } from "../../../../../src/server/services/placeService";

export async function POST(request, context) {
  const params = await context.params;
  const id = params.id;
  const body = await request.json().catch(() => ({}));
  const outcome = body.outcome;

  if (!outcome) {
    return NextResponse.json({ error: "outcome is required (Confirmed or Disputed)" }, { status: 400 });
  }

  try {
    const updated = await verifyResolution(id, outcome);
    return NextResponse.json(updated);
  } catch (error) {
    if (error.message === "not_found") return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    if (error.message === "not_resolved") return NextResponse.json({ error: "Complaint is not resolved yet" }, { status: 400 });
    if (error.message === "invalid_outcome") return NextResponse.json({ error: "Invalid verification outcome" }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
