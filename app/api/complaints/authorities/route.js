import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/mongodb";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const authorities = await db.collection("authorities").find({}).toArray();
    const complaints = await db.collection("complaints").find({}).toArray();

    const data = authorities.map(auth => {
      const authId = auth.authority_id;
      const authComplaints = complaints.filter(c => {
        return c.authority_id === authId || c.assigned_authorities?.some(a => a.authority_id === authId);
      });
      
      const total = authComplaints.length;
      const resolved = authComplaints.filter(c => ["Resolved", "Closed"].includes(c.status)).length;
      const disputed = authComplaints.filter(c => c.verification_status === "Disputed").length;
      const open = authComplaints.filter(c => !["Resolved", "Closed"].includes(c.status) && c.status !== "Moderation").length;
      
      const defaultScore = auth.metrics?.score || (total ? Math.round(((resolved - disputed * 0.5) / Math.max(1, total)) * 100) : 75);
      const score = Math.max(0, Math.min(100, defaultScore));

      return {
        ...auth,
        _id: undefined,
        metrics: {
          score,
          total_complaints: total,
          resolved_complaints: resolved,
          disputed_complaints: disputed,
          open_complaints: open
        }
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
