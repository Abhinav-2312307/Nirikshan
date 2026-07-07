import { NextResponse } from "next/server";
import { resolvePlace, getPlaceMetrics, findAreaForPoint } from "../../../../src/server/services/placeService";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  try {
    const resolved = await resolvePlace(lat, lng);
    const metrics = await getPlaceMetrics(resolved.place.properties.place_id);
    const area = findAreaForPoint(lat, lng);

    return NextResponse.json({
      ...resolved,
      metrics,
      area: area
        ? {
            area_id: area.properties.area_id,
            name: area.properties.name,
            authority: area.properties.authority || 
                       (area.properties.level === "state" ? "State Government" : 
                        area.properties.level === "district" ? "District Administration" : 
                        area.properties.level === "subdistrict" ? "Tehsil Office" : "Local Authority"),
            city: area.properties.city
          }
        : null
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
