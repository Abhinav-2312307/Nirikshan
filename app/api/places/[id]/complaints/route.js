import { NextResponse } from "next/server";
import { getPlaceById, addComplaint } from "../../../../../src/server/services/placeService";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary using env variables (note the typo CLOUDNARY_API matching the .env)
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDNARY_API, 
  api_secret: process.env.CLOUDNARY_SECRET 
});

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
    let imageUrl = null;
    if (payload.image && payload.image.startsWith("data:image")) {
      const uploadRes = await cloudinary.uploader.upload(payload.image, {
        folder: "nirikshan_complaints"
      });
      imageUrl = uploadRes.secure_url;
    }

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

    const complaintPayload = {
      ...payload,
      image_url: imageUrl
    };

    const created = await addComplaint(placeFeature, complaintPayload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Complaint Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
