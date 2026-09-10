import { NextResponse } from "next/server";
import { authenticate } from "../../../../src/server/services/authService";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password, role = "officer" } = body;

    const result = await authenticate({ email, password, role });

    const response = NextResponse.json({
      success: true,
      ...result
    });

    // Set HTTP-only cookie for session persistence
    const cookieName = role === "officer" ? "nirikshan_officer_token" : "nirikshan_citizen_token";
    response.cookies.set(cookieName, result.token, {
      httpOnly: false, // allow client-side hydration
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
      sameSite: "lax"
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
