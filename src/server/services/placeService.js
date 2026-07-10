import crypto from "crypto";
import { connectToDatabase } from "../../../lib/mongodb";
import {
  pointInPolygon,
  haversineMeters,
  pointLineDistanceMeters,
  centroidOfPolygon,
  centerOfFeature
} from "../utils/geo";
import { getAreas } from "../repositories/dataRepository";

const STATUS_FLOW = ["Submitted", "Verified", "Assigned", "In Progress", "Resolved", "Closed"];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function findAreaForPoint(lat, lng) {
  const levels = ["submicro", "micro", "macro", "kanpur-subdistricts", "up-districts", "india-states"];
  const point = [lng, lat];
  for (const lvl of levels) {
    const dataset = getAreas(lvl);
    for (const feature of dataset.features) {
      const geom = feature.geometry || {};
      if (geom.type === "Polygon") {
        const rings = geom.coordinates || [];
        if (rings.length && pointInPolygon(point, rings[0])) {
          return feature;
        }
      } else if (geom.type === "MultiPolygon") {
        const coords = geom.coordinates || [];
        for (const polygon of coords) {
          if (polygon.length && pointInPolygon(point, polygon[0])) {
            return feature;
          }
        }
      }
    }
  }
  return null;
}

function geometryDistanceMeters(point, feature) {
  const geometry = feature.geometry || {};
  if (geometry.type === "Point") {
    return haversineMeters(point, geometry.coordinates);
  }
  if (geometry.type === "LineString") {
    return pointLineDistanceMeters(point, geometry.coordinates);
  }
  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates[0] || [];
    if (!ring.length) return Number.POSITIVE_INFINITY;
    if (pointInPolygon(point, ring)) return 0;
    return haversineMeters(point, centroidOfPolygon(ring));
  }
  return Number.POSITIVE_INFINITY;
}

export async function getPlaceMetrics(placeId) {
  const { db } = await connectToDatabase();
  const reviews = await db.collection("reviews").find({ place_id: placeId }).toArray();
  const complaints = await db.collection("complaints").find({ place_id: placeId }).toArray();
  const open = complaints.filter((c) => !["Resolved", "Closed"].includes(c.status) && c.status !== "Moderation");

  return {
    avg_rating: reviews.length ? Number(average(reviews.map((r) => r.rating)).toFixed(1)) : 0,
    review_count: reviews.length,
    complaint_count: complaints.length,
    pending_complaints: open.length
  };
}

export async function listPlaceReviews(placeId) {
  const { db } = await connectToDatabase();
  return await db.collection("reviews")
    .find({ place_id: placeId })
    .sort({ created_at: -1 })
    .toArray();
}

export async function listPlaces(filters = {}) {
  const { db } = await connectToDatabase();
  const q = (filters.q || "").trim().toLowerCase();
  const type = filters.type;

  let query = {};
  if (type) {
    query["properties.type"] = type;
  }
  if (q) {
    query["$or"] = [
      { "properties.name": { $regex: q, $options: "i" } },
      { "properties.address": { $regex: q, $options: "i" } },
      { "properties.type": { $regex: q, $options: "i" } }
    ];
  }

  const placesList = await db.collection("places").find(query).limit(filters.limit || 200).toArray();
  
  const features = [];
  for (const f of placesList) {
    const metrics = await getPlaceMetrics(f.properties.place_id);
    features.push({
      type: "Feature",
      properties: {
        ...f.properties,
        center: centerOfFeature(f),
        metrics
      },
      geometry: f.geometry
    });
  }

  return { type: "FeatureCollection", features };
}

export async function resolvePlace(lat, lng) {
  const area = findAreaForPoint(lat, lng);
  const areaId = area?.properties?.area_id || null;

  return {
    place: {
      type: "Feature",
      properties: {
        place_id: `VIRTUAL_${lat.toFixed(5)}_${lng.toFixed(5)}`,
        name: "Selected Location",
        type: "location",
        area_id: areaId,
        address: "Pinned map location",
        is_virtual: true
      },
      geometry: {
        type: "Point",
        coordinates: [lng, lat]
      }
    },
    distance_meters: 0,
    is_virtual: true
  };
}

export async function ensurePlaceExists(placeFeature) {
  const { db } = await connectToDatabase();
  const placeId = placeFeature.properties.place_id;

  const existing = await db.collection("places").findOne({ "properties.place_id": placeId });
  if (existing) return existing;

  const doc = {
    ...placeFeature,
    location: placeFeature.geometry
  };
  delete doc._id; // clean up mongo ID if present
  
  await db.collection("places").insertOne(doc);
  return placeFeature;
}

export async function addReview(placeId, payload) {
  const rating = clamp(Number(payload.rating || 0), 1, 5);
  const comment = String(payload.comment || "").trim();

  if (!comment || !rating) {
    throw new Error("rating and comment are required");
  }

  const { db } = await connectToDatabase();
  const review = {
    review_id: crypto.randomUUID(),
    place_id: placeId,
    user_id: payload.user_id || "demo-user",
    rating,
    comment,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    created_at: new Date().toISOString()
  };

  await db.collection("reviews").insertOne(review);
  return review;
}

export function determineRouting(lat, lng, issueType, area) {
  const routes = [];
  const areaId = area?.properties?.area_id || "";
  
  let city = area?.properties?.city || "Local";
  let state = area?.properties?.state || "State";
  
  const isKanpur = city.toLowerCase().includes("kanpur") || areaId.includes("KANPUR") || areaId.includes("NAU_");

  if (isKanpur) {
    if (issueType === "Pothole" || issueType === "Streetlight" || issueType === "Encroachment") {
      routes.push({
        authority_id: "KNN",
        name: "Kanpur Nagar Nigam",
        department: issueType === "Pothole" ? "Roads" : issueType === "Streetlight" ? "Electrical" : "Enforcement"
      });
      routes.push({
        authority_id: "KDA",
        name: "Kanpur Development Authority",
        department: issueType === "Pothole" ? "Road Projects" : issueType === "Streetlight" ? "Urban Infra" : "Planning"
      });
    } else if (issueType === "Water" || issueType === "Sewer") {
      routes.push({
        authority_id: "JAL",
        name: "Jal Kal Vibhag",
        department: issueType === "Water" ? "Water Operations" : "Sewer Operations"
      });
      routes.push({
        authority_id: "KNN",
        name: "Kanpur Nagar Nigam",
        department: issueType === "Water" ? "Water Supply" : "Sewer Maintenance"
      });
    } else {
      routes.push({
        authority_id: "KNN",
        name: "Kanpur Nagar Nigam",
        department: "Sanitation"
      });
    }
  } else {
    const cityClean = city !== "Local" ? city : state;
    const municipalName = city !== "Local" ? `${city} Municipal Corporation` : `${state} Public Works Department`;
    const devAuthorityName = city !== "Local" ? `${city} Development Authority` : `${state} Urban Development`;
    const waterName = city !== "Local" ? `${city} Water & Sewerage Board` : `${state} Jal Board`;
    
    const municipalId = city !== "Local" ? city.toUpperCase().replace(" ", "_").slice(0, 4) + "_MC" : "STATE_PWD";
    const devId = city !== "Local" ? city.toUpperCase().replace(" ", "_").slice(0, 4) + "_DA" : "STATE_UD";
    const waterId = city !== "Local" ? city.toUpperCase().replace(" ", "_").slice(0, 4) + "_WB" : "STATE_JB";

    if (issueType === "Pothole" || issueType === "Streetlight" || issueType === "Encroachment") {
      routes.push({
        authority_id: municipalId,
        name: municipalName,
        department: issueType === "Pothole" ? "Roads" : issueType === "Streetlight" ? "Electrical" : "Enforcement"
      });
      routes.push({
        authority_id: devId,
        name: devAuthorityName,
        department: issueType === "Pothole" ? "Road Projects" : issueType === "Streetlight" ? "Urban Infra" : "Planning"
      });
    } else if (issueType === "Water" || issueType === "Sewer") {
      routes.push({
        authority_id: waterId,
        name: waterName,
        department: issueType === "Water" ? "Water Operations" : "Sewer Operations"
      });
      routes.push({
        authority_id: municipalId,
        name: municipalName,
        department: issueType === "Water" ? "Water Supply" : "Sewer Maintenance"
      });
    } else {
      routes.push({
        authority_id: municipalId,
        name: municipalName,
        department: "Sanitation"
      });
    }
  }

  return routes;
}

export async function addComplaint(placeFeature, payload) {
  const { db } = await connectToDatabase();
  const place = await ensurePlaceExists(placeFeature);
  const area = findAreaForPoint(payload.latitude, payload.longitude);
  const areaId = place.properties.area_id || area?.properties?.area_id || null;
  const issueType = String(payload.issue_type || "");
  const now = new Date().toISOString();

  const assigned = determineRouting(payload.latitude, payload.longitude, issueType, area);
  const disputedJurisdiction = assigned.length > 1;
  const mainAuth = assigned[0];

  const descLower = String(payload.description || "").toLowerCase();
  const suspiciousKeywords = ["spam", "abuse", "fake", "nonsense", "junk", "fraud"];
  const containsSuspicious = suspiciousKeywords.some(keyword => descLower.includes(keyword));
  const profanityFlagged = containsSuspicious || descLower.length < 5;

  const trustScore = Number(payload.user_trust_score !== undefined ? payload.user_trust_score : 50);
  const lowTrustScore = trustScore < 30;

  let initialStatus = "Submitted";
  if (profanityFlagged || lowTrustScore) {
    initialStatus = "Moderation";
  }

  // 4. Duplicate checks
  const dateLimit = new Date(Date.now() - 7 * 86400000).toISOString();
  const complaints = await db.collection("complaints").find({
    issue_type: issueType,
    status: { $nin: ["Closed", "Moderation"] },
    created_at: { $gte: dateLimit }
  }).toArray();

  let duplicateOf = null;
  for (const c of complaints) {
    const dist = haversineMeters([payload.longitude, payload.latitude], [c.longitude, c.latitude]);
    if (dist <= 150) {
      duplicateOf = c.complaint_id;
      break;
    }
  }

  const complaint = {
    complaint_id: crypto.randomUUID(),
    place_id: place.properties.place_id,
    place_name: place.properties.name,
    place_type: place.properties.type,
    area_id: areaId,
    authority_id: mainAuth.authority_id,
    authority: mainAuth.name,
    department: mainAuth.department,
    issue_type: issueType,
    severity: clamp(Number(payload.severity || 1), 1, 3),
    description: String(payload.description || "").trim(),
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
    location: {
      type: "Point",
      coordinates: [Number(payload.longitude), Number(payload.latitude)]
    },
    status: initialStatus,
    disputed_jurisdiction: disputedJurisdiction,
    assigned_authorities: assigned,
    duplicate_of: duplicateOf,
    is_duplicate: duplicateOf !== null,
    verification_status: "Pending",
    reopened_count: 0,
    user_trust_score: trustScore,
    ai_validation: {
      profanity_flagged: profanityFlagged,
      image_relevant: true,
      face_blurred: true,
      exif_stripped: true
    },
    created_at: now,
    updated_at: now
  };

  await db.collection("complaints").insertOne(complaint);
  return complaint;
}

export async function listComplaints(filters = {}) {
  const { db } = await connectToDatabase();
  let query = {};
  
  if (!filters.include_moderation) {
    query.status = { $ne: "Moderation" };
  }
  if (filters.place_id) {
    query.place_id = filters.place_id;
  }
  if (filters.area_id) {
    query.area_id = filters.area_id;
  }
  if (filters.authority_id) {
    query["$or"] = [
      { authority_id: filters.authority_id },
      { "assigned_authorities.authority_id": filters.authority_id }
    ];
  }

  const complaints = await db.collection("complaints").find(query).sort({ created_at: -1 }).toArray();

  return complaints.map(c => {
    const daysUnresolved = (Date.now() - new Date(c.updated_at || c.created_at).getTime()) / 86400000;
    const isUnresolved = !["Resolved", "Closed"].includes(c.status);
    return {
      ...c,
      _id: undefined,
      escalated: isUnresolved && daysUnresolved > 30
    };
  });
}

export async function advanceComplaintStatus(complaintId, requested) {
  const { db } = await connectToDatabase();
  const complaint = await db.collection("complaints").findOne({ complaint_id: complaintId });
  if (!complaint) throw new Error("not_found");

  let nextStatus = requested;
  if (requested) {
    if (!STATUS_FLOW.includes(requested) && requested !== "Moderation") throw new Error("invalid_status");
  } else {
    const index = STATUS_FLOW.indexOf(complaint.status);
    if (index === STATUS_FLOW.length - 1) throw new Error("terminal_status");
    nextStatus = STATUS_FLOW[index + 1];
  }

  const now = new Date().toISOString();
  await db.collection("complaints").updateOne(
    { complaint_id: complaintId },
    { $set: { status: nextStatus, updated_at: now } }
  );

  return {
    ...complaint,
    _id: undefined,
    status: nextStatus,
    updated_at: now
  };
}

export async function verifyResolution(complaintId, outcome) {
  const { db } = await connectToDatabase();
  const complaint = await db.collection("complaints").findOne({ complaint_id: complaintId });
  if (!complaint) throw new Error("not_found");
  if (complaint.status !== "Resolved") throw new Error("not_resolved");

  const now = new Date().toISOString();
  const authIds = complaint.assigned_authorities?.map(a => a.authority_id) || [complaint.authority_id];

  let nextStatus = complaint.status;
  let nextVerif = complaint.verification_status;
  let reopenedCount = complaint.reopened_count || 0;

  if (outcome === "Confirmed") {
    nextStatus = "Closed";
    nextVerif = "Confirmed";
    
    for (const authId of authIds) {
      const auth = await db.collection("authorities").findOne({ authority_id: authId });
      if (auth) {
        const metrics = auth.metrics || { score: 75, total_resolved: 0, total_disputed: 0 };
        metrics.total_resolved = (metrics.total_resolved || 0) + 1;
        metrics.score = clamp((metrics.score || 75) + 10, 0, 100);
        await db.collection("authorities").updateOne(
          { authority_id: authId },
          { $set: { metrics } }
        );
      }
    }
  } else if (outcome === "Disputed") {
    nextStatus = "In Progress";
    nextVerif = "Disputed";
    reopenedCount += 1;

    for (const authId of authIds) {
      const auth = await db.collection("authorities").findOne({ authority_id: authId });
      if (auth) {
        const metrics = auth.metrics || { score: 75, total_resolved: 0, total_disputed: 0 };
        metrics.total_disputed = (metrics.total_disputed || 0) + 1;
        metrics.score = clamp((metrics.score || 75) - 20, 0, 100);
        await db.collection("authorities").updateOne(
          { authority_id: authId },
          { $set: { metrics } }
        );
      }
    }
  } else {
    throw new Error("invalid_outcome");
  }

  await db.collection("complaints").updateOne(
    { complaint_id: complaintId },
    { $set: { status: nextStatus, verification_status: nextVerif, reopened_count: reopenedCount, updated_at: now } }
  );

  return {
    ...complaint,
    _id: undefined,
    status: nextStatus,
    verification_status: nextVerif,
    reopened_count: reopenedCount,
    updated_at: now
  };
}

export async function getPlaceById(placeId) {
  const { db } = await connectToDatabase();
  const p = await db.collection("places").findOne({ "properties.place_id": placeId });
  if (p) {
    p._id = undefined;
  }
  return p;
}
