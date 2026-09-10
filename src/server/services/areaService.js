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

export function computeAreaScoreDirect(areaFeature, level, areaReviews, areaComplaints) {
  const baseScore = areaFeature.properties.base_score || 50;

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

// Kept for backward compatibility
export function computeAreaScore(areaFeature, level, reviews, complaints, placesMap, ancestorSetMap) {
  const areaId = areaFeature.properties.area_id;
  const isMatch = (itemAreaId) => {
    if (!itemAreaId) return false;
    if (itemAreaId === areaId) return true;
    const ancestors = ancestorSetMap.get(itemAreaId);
    return ancestors ? ancestors.has(areaId) : false;
  };
  const areaComplaints = complaints.filter(c => isMatch(c.area_id));
  const areaReviews = reviews.filter(r => {
    if (isMatch(r.place_id)) return true;
    const place = placesMap.get(r.place_id);
    return place && isMatch(place.properties?.area_id || place.area_id);
  });
  return computeAreaScoreDirect(areaFeature, level, areaReviews, areaComplaints);
}

let cachedAreaParentMap = null;
let cachedAncestorSetMap = null;

function getAreaHierarchy() {
  if (cachedAreaParentMap && cachedAncestorSetMap) {
    return { areaParentMap: cachedAreaParentMap, ancestorSetMap: cachedAncestorSetMap };
  }

  const map = new Map();
  
  const distFeatures = getAreas("up-districts").features || [];
  const subdistFeatures = getAreas("kanpur-subdistricts").features || [];
  const macroFeatures = getAreas("macro").features || [];
  const microFeatures = getAreas("micro").features || [];
  const submicroFeatures = getAreas("submicro").features || [];

  distFeatures.forEach(f => {
    if (f.properties?.parent_area_id) map.set(f.properties.area_id, f.properties.parent_area_id);
  });
  subdistFeatures.forEach(f => {
    if (f.properties?.parent_area_id) map.set(f.properties.area_id, f.properties.parent_area_id);
  });
  macroFeatures.forEach(f => {
    if (f.properties?.parent_area_id) map.set(f.properties.area_id, f.properties.parent_area_id);
  });
  microFeatures.forEach(f => {
    if (f.properties?.parent_area_id) map.set(f.properties.area_id, f.properties.parent_area_id);
  });
  submicroFeatures.forEach(f => {
    if (f.properties?.parent_area_id) map.set(f.properties.area_id, f.properties.parent_area_id);
  });

  const ancestorMap = new Map();
  for (const id of map.keys()) {
    const set = new Set([id]);
    let curr = id;
    for (let i = 0; i < 10; i++) {
      const p = map.get(curr);
      if (!p || p === curr) break;
      set.add(p);
      curr = p;
    }
    ancestorMap.set(id, set);
  }

  cachedAreaParentMap = map;
  cachedAncestorSetMap = ancestorMap;
  return { areaParentMap: map, ancestorSetMap: ancestorMap };
}

const DB_CACHE_TTL_MS = 600000; // 10 minutes

async function getDbData() {
  const now = Date.now();
  if (global._areaServiceCachedDbData && (now - (global._areaServiceCachedDbDataTime || 0) < DB_CACHE_TTL_MS)) {
    return global._areaServiceCachedDbData;
  }
  const { db } = await connectToDatabase();
  const [places, reviews, complaints] = await Promise.all([
    db.collection("places").find({}, { projection: { "properties.place_id": 1, "properties.area_id": 1, area_id: 1, place_id: 1 } }).toArray(),
    db.collection("reviews").find({}, { projection: { place_id: 1, rating: 1 } }).toArray(),
    db.collection("complaints").find({}, { projection: { area_id: 1, status: 1, created_at: 1, updated_at: 1 } }).toArray()
  ]);
  const data = { places, reviews, complaints };
  global._areaServiceCachedDbData = data;
  global._areaServiceCachedDbDataTime = now;
  return data;
}

export function invalidateAreaCache() {
  global._areaServiceCachedDbData = null;
  global._areaServiceCachedDbDataTime = 0;
}

const areaScoreCache = new Map();
const AREA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateAreaCache() {
  areaScoreCache.clear();
}

export async function listAreas(level) {
  const now = Date.now();
  const cached = areaScoreCache.get(level);
  if (cached && (now - cached.timestamp < AREA_CACHE_TTL_MS)) {
    return cached.data;
  }

  const dataset = getAreas(level);
  const { places, reviews, complaints } = await getDbData();

  const placesMap = new Map(places.map(p => [p.properties?.place_id || p.place_id, p]));
  const { ancestorSetMap } = getAreaHierarchy();

  // Inverted index for O(1) grouping across areas
  const complaintsByArea = new Map();
  for (const c of complaints) {
    if (!c.area_id) continue;
    const ancestors = ancestorSetMap.get(c.area_id);
    if (ancestors) {
      for (const a of ancestors) {
        let arr = complaintsByArea.get(a);
        if (!arr) complaintsByArea.set(a, arr = []);
        arr.push(c);
      }
    } else {
      let arr = complaintsByArea.get(c.area_id);
      if (!arr) complaintsByArea.set(c.area_id, arr = []);
      arr.push(c);
    }
  }

  const reviewsByArea = new Map();
  for (const r of reviews) {
    let targetAreaId = r.place_id;
    if (placesMap.has(r.place_id)) {
      const p = placesMap.get(r.place_id);
      targetAreaId = p?.properties?.area_id || p?.area_id || r.place_id;
    }
    if (!targetAreaId) continue;
    const ancestors = ancestorSetMap.get(targetAreaId);
    if (ancestors) {
      for (const a of ancestors) {
        let arr = reviewsByArea.get(a);
        if (!arr) reviewsByArea.set(a, arr = []);
        arr.push(r);
      }
    } else {
      let arr = reviewsByArea.get(targetAreaId);
      if (!arr) reviewsByArea.set(targetAreaId, arr = []);
      arr.push(r);
    }
  }

  const result = {
    type: "FeatureCollection",
    features: dataset.features.map((feature) => {
      const areaId = feature.properties.area_id;
      const areaComplaints = complaintsByArea.get(areaId) || [];
      const areaReviews = reviewsByArea.get(areaId) || [];
      const score = computeAreaScoreDirect(feature, level, areaReviews, areaComplaints);
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

  areaScoreCache.set(level, { data: result, timestamp: now });
  return result;
}

