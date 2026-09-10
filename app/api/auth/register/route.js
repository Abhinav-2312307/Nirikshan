import { NextResponse } from "next/server";
import { registerCitizen } from "../../../../src/server/services/authService";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await registerCitizen(body);

    const response = NextResponse.json({
      success: true,
      ...result
    });

    response.cookies.set("nirikshan_citizen_token", result.token, {
      httpOnly: false,
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
      sameSite: "lax"
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
