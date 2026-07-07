import { getAreas } from "../repositories/dataRepository";
import { connectToDatabase } from "../../../lib/mongodb";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreToStatus(score) {
  if (score >= 81) return "Well-maintained";
  if (score >= 61) return "Acceptable";
  if (score >= 31) return "Poor";
  return "Critical";
}

export function computeAreaScore(areaFeature, level, reviews, complaints, places, areaParentMap) {
  const areaId = areaFeature.properties.area_id;
  const baseScore = areaFeature.properties.base_score || 50;

  const placesMap = new Map(places.map(p => [p.properties.place_id, p]));

  const isMatch = (itemAreaId) => {
    if (!itemAreaId) return false;
    let current = itemAreaId;
    // Walk up the parent map (max depth 10 to prevent cycles)
    for (let i = 0; i < 10; i++) {
      if (current === areaId) return true;
      const nextParent = areaParentMap.get(current);
      if (!nextParent || nextParent === current) break;
      current = nextParent;
    }
    return false;
  };

  const areaComplaints = complaints.filter(c => isMatch(c.area_id));
  const areaReviews = reviews.filter(r => {
    const place = placesMap.get(r.place_id);
    return place && isMatch(place.properties.area_id || place.area_id);
  });

  // 1. Citizen Rating Score R_a(t) - (40%)
  const avgRating = areaReviews.length ? (areaReviews.reduce((sum, r) => sum + r.rating, 0) / areaReviews.length) : null;
  const citizenRatingScore = avgRating !== null ? (avgRating / 5) * 100 : baseScore;

  // 2. Open Issues Count Score I_a(t) - (35%)
  const openComplaints = areaComplaints.filter(c => !["Resolved", "Closed"].includes(c.status) && c.status !== "Moderation");
  const openCount = openComplaints.length;
  let issueDensityScore = 100;
  if (openCount > 0) {
    if (level === "india-states" || level === "states") {
      issueDensityScore = Math.max(10, 100 - openCount * 0.5);
    } else if (level === "up-districts" || level === "districts") {
      issueDensityScore = Math.max(10, 100 - openCount * 2);
    } else if (level === "kanpur-subdistricts" || level === "subdistricts") {
      issueDensityScore = Math.max(10, 100 - openCount * 5);
    } else {
      // Wards (macro/micro/submicro)
      issueDensityScore = Math.max(10, 100 - openCount * 12);
    }
  }

  // 3. Issue Resolution Speed Score S_a(t) - (25%)
  const resolvedComplaints = areaComplaints.filter(c => ["Resolved", "Closed"].includes(c.status));
  let resolutionSpeedScore = 100;
  if (resolvedComplaints.length > 0) {
    const speeds = resolvedComplaints.map(c => {
      const start = new Date(c.created_at).getTime();
      const end = new Date(c.updated_at).getTime();
      return Math.max(1, (end - start) / 86400000); // speed in days
    });
    const avgDays = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
    resolutionSpeedScore = Math.max(10, 100 - (avgDays * 3));
  } else if (openCount > 0) {
    resolutionSpeedScore = 50; // no resolutions but issues exist
  }

  // Final Composite Score = 0.40 * R_a(t) + 0.35 * I_a(t) + 0.25 * S_a(t)
  const finalScore = Math.round(
    0.40 * citizenRatingScore +
    0.35 * issueDensityScore +
    0.25 * resolutionSpeedScore
  );

  return clamp(finalScore, 0, 100);
}

export async function listAreas(level) {
  const dataset = getAreas(level);
  
  const { db } = await connectToDatabase();
  const places = await db.collection("places").find({}).toArray();
  const reviews = await db.collection("reviews").find({}).toArray();
  const complaints = await db.collection("complaints").find({}).toArray();

  const areaParentMap = new Map();
  
  const distFeatures = getAreas("up-districts").features || [];
  const subdistFeatures = getAreas("kanpur-subdistricts").features || [];
  const macroFeatures = getAreas("macro").features || [];
  const microFeatures = getAreas("micro").features || [];
  const submicroFeatures = getAreas("submicro").features || [];

  distFeatures.forEach(f => {
    if (f.properties.parent_area_id) areaParentMap.set(f.properties.area_id, f.properties.parent_area_id);
  });
  subdistFeatures.forEach(f => {
    if (f.properties.parent_area_id) areaParentMap.set(f.properties.area_id, f.properties.parent_area_id);
  });
  macroFeatures.forEach(f => {
    if (f.properties.parent_area_id) areaParentMap.set(f.properties.area_id, f.properties.parent_area_id);
  });
  microFeatures.forEach(f => {
    if (f.properties.parent_area_id) areaParentMap.set(f.properties.area_id, f.properties.parent_area_id);
  });
  submicroFeatures.forEach(f => {
    if (f.properties.parent_area_id) areaParentMap.set(f.properties.area_id, f.properties.parent_area_id);
  });

  return {
    type: "FeatureCollection",
    features: dataset.features.map((feature) => {
      const score = computeAreaScore(feature, level, reviews, complaints, places, areaParentMap);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          area_score: score,
          area_status: scoreToStatus(score)
        }
      };
    })
  };
}
