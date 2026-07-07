import { NextResponse } from "next/server";
import { listComplaints } from "../../../src/server/services/placeService";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const include_moderation = searchParams.get("include_moderation") === "true";
  const place_id = searchParams.get("place_id");
  const area_id = searchParams.get("area_id");
  const authority_id = searchParams.get("authority_id");

  try {
    const data = await listComplaints({
      place_id,
      area_id,
      authority_id,
      include_moderation
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
