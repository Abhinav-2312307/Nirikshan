import { NextResponse } from "next/server";
import { listPlaceReviews, addReview } from "../../../../../src/server/services/placeService";

export async function GET(request, context) {
  const params = await context.params;
  const id = params.id;

  try {
    const reviews = await listPlaceReviews(id);
    return NextResponse.json(reviews);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, context) {
  const params = await context.params;
  const id = params.id;
  const payload = await request.json();

  try {
    const created = await addReview(id, payload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
