import { NextResponse } from "next/server";
import { listAreas } from "../../../src/server/services/areaService";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") || "macro";
  
  try {
    const data = await listAreas(level);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
