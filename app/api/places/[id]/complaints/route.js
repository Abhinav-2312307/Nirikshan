import { NextResponse } from "next/server";
import { getPlaceById, addComplaint } from "../../../../../src/server/services/placeService";

export async function POST(request, context) {
  const params = await context.params;
  const id = params.id;
  const payload = await request.json();

  const lat = Number(payload.latitude);
  const lng = Number(payload.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !payload.issue_type || !payload.description) {
    return NextResponse.json({
      error: "latitude, longitude, issue_type and description are required"
    }, { status: 400 });
  }

  try {
    const place = await getPlaceById(id);
    const placeFeature = place || {
      type: "Feature",
      properties: {
        place_id: id,
        name: payload.place_name || "Selected Location",
        type: payload.place_type || "location",
        area_id: null,
        address: payload.address || "Pinned map location"
      },
      geometry: {
        type: "Point",
        coordinates: [lng, lat]
      }
    };

    const created = await addComplaint(placeFeature, payload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
