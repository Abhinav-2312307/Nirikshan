import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../lib/mongodb";

export async function POST(request, context) {
  const params = await context.params;
  const id = params.id;

  try {
    const { db } = await connectToDatabase();
    const complaint = await db.collection("complaints").findOne({ complaint_id: id });
    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    }

    const flagsCount = (complaint.flags_count || 0) + 1;
    const now = new Date().toISOString();

    let newStatus = complaint.status;
    if (flagsCount >= 3 && complaint.status !== "Moderation") {
      newStatus = "Moderation";
    }

    await db.collection("complaints").updateOne(
      { complaint_id: id },
      { $set: { flags_count: flagsCount, status: newStatus, updated_at: now } }
    );

    return NextResponse.json({ ok: true, flags_count: flagsCount, status: newStatus });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
