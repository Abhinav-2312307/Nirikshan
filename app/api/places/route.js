import { NextResponse } from "next/server";
import { listPlaces } from "../../../src/server/services/placeService";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const type = searchParams.get("type") || "";
  const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit")) || 200));

  try {
    const data = await listPlaces({ q, type, limit });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
