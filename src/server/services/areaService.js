const { getAreas, getReviews, getComplaints, getPlaces } = require("../repositories/dataRepository");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreToStatus(score) {
  if (score >= 81) return "Well-maintained";
  if (score >= 61) return "Acceptable";
  if (score >= 31) return "Poor";
  return "Critical";
}

function computeAreaScore(areaFeature, level, reviews, complaints, places, areaParentMap) {
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
  const ratingScore = avgRating !== null ? clamp((avgRating - 1) / 4 * 100, 0, 100) : baseScore;

  // 2. Complaint Severity Score S_a(t) - (30%)
  const unresolvedComplaints = areaComplaints.filter(c => !["Resolved", "Closed"].includes(c.status));
  let totalSeverityPenalty = 0;
  unresolvedComplaints.forEach(c => {
    // Critical = 5, High = 3, Medium = 2, Low = 1
    let weight = 1;
    if (c.severity === 5 || c.severity === "Critical") weight = 5;
    else if (c.severity === 3 || c.severity === "High") weight = 3;
    else if (c.severity === 2 || c.severity === "Medium") weight = 2;
    totalSeverityPenalty += weight;
  });
  const severityScore = clamp(100 - totalSeverityPenalty * 6, 0, 100);

  // 3. Resolution Efficiency Score E_a(t) - (20%)
  const totalComplaintsCount = areaComplaints.length;
  const resolvedCount = areaComplaints.filter(c => ["Resolved", "Closed"].includes(c.status)).length;
  const disputedCount = areaComplaints.filter(c => c.verification_status === "Disputed").length;
  const ratio = totalComplaintsCount ? (resolvedCount / totalComplaintsCount) : 1.0;
  const efficiencyScore = clamp(ratio * 100 - disputedCount * 15, 0, 100);

  // 4. Data Freshness Score F_a(t) - (10%)
  let latestTime = null;
  areaReviews.forEach(r => {
    const t = new Date(r.created_at).getTime();
    if (!latestTime || t > latestTime) latestTime = t;
  });
  areaComplaints.forEach(c => {
    const t = new Date(c.updated_at || c.created_at).getTime();
    if (!latestTime || t > latestTime) latestTime = t;
  });

  let freshnessScore = 50;
  if (latestTime) {
    const daysSinceLastEvent = (Date.now() - latestTime) / 86400000;
    freshnessScore = clamp(Math.round(100 * Math.exp(-daysSinceLastEvent / 30)), 0, 100);
  }

  // Combined score
  const finalScore = Math.round(
    ratingScore * 0.4 +
    severityScore * 0.3 +
    efficiencyScore * 0.2 +
    freshnessScore * 0.1
  );

  return clamp(finalScore, 0, 100);
}

function listAreas(level) {
  const dataset = getAreas(level);
  const places = getPlaces().features;
  const reviews = getReviews();
  const complaints = getComplaints();

  // Build the hierarchical parent-child ancestor lookup map once
  const areaParentMap = new Map();
  
  const distFeatures = getAreas("up-districts").features || getAreas("districts").features || [];
  const subdistFeatures = getAreas("kanpur-subdistricts").features || getAreas("subdistricts").features || [];
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

module.exports = { listAreas, computeAreaScore };
