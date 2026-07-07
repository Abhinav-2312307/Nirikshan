import { NextResponse } from "next/server";
import { getPlaceById, getPlaceMetrics } from "../../../../src/server/services/placeService";

export async function GET(request, context) {
  const params = await context.params;
  const id = params.id;

  try {
    const place = await getPlaceById(id);
    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }
    const metrics = await getPlaceMetrics(id);
    return NextResponse.json({ place, metrics });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
