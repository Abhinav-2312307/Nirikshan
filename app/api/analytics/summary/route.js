import { NextResponse } from "next/server";
import { getSummary } from "../../../../src/server/services/analyticsService";

export async function GET() {
  try {
    const data = await getSummary();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
