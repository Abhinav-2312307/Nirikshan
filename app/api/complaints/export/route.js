import { NextResponse } from "next/server";
import { listComplaints } from "../../../../src/server/services/placeService";

export async function GET() {
  try {
    const complaints = await listComplaints({ include_moderation: true });

    const headers = [
      "complaint_id", "place_name", "area_id", "authority", "issue_type", 
      "severity", "description", "latitude", "longitude", "status", 
      "disputed_jurisdiction", "verification_status", "reopened_count", "created_at"
    ];

    const csvRows = [headers.join(",")];
    for (const c of complaints) {
      const values = headers.map(header => {
        let val = c[header] !== undefined ? c[header] : "";
        if (typeof val === "string") {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvRows.push(values.join(","));
    }

    const csvContent = csvRows.join("\n");
    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="civic_complaints_export.csv"'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
