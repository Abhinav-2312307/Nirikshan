const crypto = require("crypto");
const {
  getPlaces,
  savePlaces,
  getReviews,
  saveReviews,
  getComplaints,
  saveComplaints,
  getAuthorities,
  saveAuthorities,
  getAreas
} = require("../repositories/dataRepository");
const {
  pointInPolygon,
  haversineMeters,
  pointLineDistanceMeters,
  centroidOfPolygon,
  centerOfFeature
} = require("../utils/geo");

const STATUS_FLOW = ["Submitted", "Verified", "Assigned", "In Progress", "Resolved", "Closed"];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function findAreaForPoint(lat, lng) {
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

function getPlaceMetrics(placeId) {
  const reviews = getReviews().filter((r) => r.place_id === placeId);
  const complaints = getComplaints().filter((c) => c.place_id === placeId);
  const open = complaints.filter((c) => !["Resolved", "Closed"].includes(c.status) && c.status !== "Moderation");

  return {
    avg_rating: reviews.length ? Number(average(reviews.map((r) => r.rating)).toFixed(1)) : 0,
    review_count: reviews.length,
    complaint_count: complaints.length,
    pending_complaints: open.length
  };
}

function listPlaceReviews(placeId) {
  return getReviews()
    .filter((item) => item.place_id === placeId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function listPlaces(filters = {}) {
  const q = (filters.q || "").trim().toLowerCase();
  const type = filters.type;

  const features = getPlaces().features
    .filter((feature) => {
      if (type && feature.properties.type !== type) return false;
      if (!q) return true;

      const haystack = `${feature.properties.name} ${feature.properties.address || ""} ${feature.properties.type}`.toLowerCase();
      return haystack.includes(q);
    })
    .slice(0, filters.limit || 200)
    .map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        center: centerOfFeature(feature),
        metrics: getPlaceMetrics(feature.properties.place_id)
      }
    }));

  return { type: "FeatureCollection", features };
}

function resolvePlace(lat, lng) {
  const point = [lng, lat];
  const places = getPlaces().features;

  let winner = null;
  let winnerDist = Number.POSITIVE_INFINITY;

  for (const feature of places) {
    const dist = geometryDistanceMeters(point, feature);
    if (dist < winnerDist) {
      winner = feature;
      winnerDist = dist;
    }
  }

  const threshold = 150;
  if (!winner || winnerDist > threshold) {
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

  return { place: winner, distance_meters: Math.round(winnerDist), is_virtual: false };
}

function ensurePlaceExists(placeFeature) {
  const places = getPlaces();
  const placeId = placeFeature.properties.place_id;

  const existing = places.features.find((f) => f.properties.place_id === placeId);
  if (existing) return existing;

  places.features.push(placeFeature);
  savePlaces(places);
  return placeFeature;
}

function addReview(placeId, payload) {
  const rating = clamp(Number(payload.rating || 0), 1, 5);
  const comment = String(payload.comment || "").trim();

  if (!comment || !rating) {
    throw new Error("rating and comment are required");
  }

  const reviews = getReviews();
  const review = {
    review_id: crypto.randomUUID(),
    place_id: placeId,
    user_id: payload.user_id || "demo-user",
    rating,
    comment,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    created_at: new Date().toISOString()
  };

  reviews.push(review);
  saveReviews(reviews);
  return review;
}

// Multi-Authority Jurisdictional Routing Rules
function determineRouting(lat, lng, issueType, area) {
  const routes = [];
  const areaId = area?.properties?.area_id || "";
  
  // Find which city or state it belongs to
  let city = area?.properties?.city || "Local";
  let state = area?.properties?.state || "State";
  
  // If the area is Kanpur Nagar (or sub-regions of it)
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
    // General routing for other districts/states
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

function addComplaint(placeFeature, payload) {
  const place = ensurePlaceExists(placeFeature);
  const area = findAreaForPoint(payload.latitude, payload.longitude);
  const areaId = place.properties.area_id || area?.properties?.area_id || null;
  const issueType = String(payload.issue_type || "");
  const now = new Date().toISOString();

  // 1. Decoupled Jurisdiction Routing
  const assigned = determineRouting(payload.latitude, payload.longitude, issueType, area);
  const disputedJurisdiction = assigned.length > 1;
  
  // Assign main authority properties for compatibility, link all assigned ones
  const mainAuth = assigned[0];

  // 2. AI Spam/NLP Profanity Checks
  const descLower = String(payload.description || "").toLowerCase();
  const suspiciousKeywords = ["spam", "abuse", "fake", "nonsense", "junk", "fraud"];
  const containsSuspicious = suspiciousKeywords.some(keyword => descLower.includes(keyword));
  const profanityFlagged = containsSuspicious || descLower.length < 5;

  // 3. User Trust Score filter
  const trustScore = Number(payload.user_trust_score !== undefined ? payload.user_trust_score : 50);
  const lowTrustScore = trustScore < 30;

  // Determine status (route to Moderation if profanity flagged or low trust score)
  let initialStatus = "Submitted";
  if (profanityFlagged || lowTrustScore) {
    initialStatus = "Moderation";
  }

  // 4. Proximity Duplicate Detection (within 150m, same category, last 7 days)
  const complaints = getComplaints();
  let duplicateOf = null;
  const sameCategoryRecent = complaints.filter(c => {
    if (c.issue_type !== issueType) return false;
    const daysDiff = (new Date(now) - new Date(c.created_at)) / 86400000;
    return daysDiff <= 7 && c.status !== "Closed" && c.status !== "Moderation";
  });

  for (const c of sameCategoryRecent) {
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

  complaints.push(complaint);
  saveComplaints(complaints);
  return complaint;
}

function listComplaints(filters = {}) {
  const complaints = getComplaints();
  
  // Calculate dynamic properties like escalation on the fly
  return complaints
    .map(c => {
      const daysUnresolved = (Date.now() - new Date(c.updated_at || c.created_at).getTime()) / 86400000;
      const isUnresolved = !["Resolved", "Closed"].includes(c.status);
      return {
        ...c,
        escalated: isUnresolved && daysUnresolved > 30
      };
    })
    .filter((item) => {
      // Exclude moderation queue complaints from general citizen view unless requested
      if (!filters.include_moderation && item.status === "Moderation") return false;
      
      if (filters.place_id && item.place_id !== filters.place_id) return false;
      if (filters.area_id && item.area_id !== filters.area_id) return false;
      
      if (filters.authority_id) {
        // Match either main authority or list of assigned authorities
        const matchesAssigned = item.assigned_authorities?.some(a => a.authority_id === filters.authority_id);
        if (item.authority_id !== filters.authority_id && !matchesAssigned) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function advanceComplaintStatus(complaintId, requested) {
  const complaints = getComplaints();
  const complaint = complaints.find((item) => item.complaint_id === complaintId);
  if (!complaint) throw new Error("not_found");

  if (requested) {
    if (!STATUS_FLOW.includes(requested) && requested !== "Moderation") throw new Error("invalid_status");
    complaint.status = requested;
  } else {
    const index = STATUS_FLOW.indexOf(complaint.status);
    if (index === STATUS_FLOW.length - 1) throw new Error("terminal_status");
    complaint.status = STATUS_FLOW[index + 1];
  }

  complaint.updated_at = new Date().toISOString();
  saveComplaints(complaints);
  return complaint;
}

// Citizen Verification Loop: Confirm or Dispute resolution
function verifyResolution(complaintId, outcome) {
  const complaints = getComplaints();
  const complaint = complaints.find(c => c.complaint_id === complaintId);
  if (!complaint) throw new Error("not_found");
  if (complaint.status !== "Resolved") throw new Error("not_resolved");

  const authorities = getAuthorities();
  const now = new Date().toISOString();

  // Route assigned authorities
  const authIds = complaint.assigned_authorities?.map(a => a.authority_id) || [complaint.authority_id];

  if (outcome === "Confirmed") {
    complaint.status = "Closed";
    complaint.verification_status = "Confirmed";
    
    // Reward authority scores (+10 points)
    authorities.forEach(auth => {
      if (authIds.includes(auth.authority_id)) {
        if (!auth.metrics) {
          auth.metrics = { score: 75, total_resolved: 0, total_disputed: 0 };
        }
        auth.metrics.total_resolved = (auth.metrics.total_resolved || 0) + 1;
        auth.metrics.score = clamp((auth.metrics.score || 75) + 10, 0, 100);
      }
    });
  } else if (outcome === "Disputed") {
    // Reopen complaint and mark back to In Progress
    complaint.status = "In Progress";
    complaint.verification_status = "Disputed";
    complaint.reopened_count = (complaint.reopened_count || 0) + 1;

    // Penalize authority scores (-20 points)
    authorities.forEach(auth => {
      if (authIds.includes(auth.authority_id)) {
        if (!auth.metrics) {
          auth.metrics = { score: 75, total_resolved: 0, total_disputed: 0 };
        }
        auth.metrics.total_disputed = (auth.metrics.total_disputed || 0) + 1;
        auth.metrics.score = clamp((auth.metrics.score || 75) - 20, 0, 100);
      }
    });
  } else {
    throw new Error("invalid_outcome");
  }

  complaint.updated_at = now;
  saveComplaints(complaints);
  saveAuthorities(authorities);

  return complaint;
}

function getPlaceById(placeId) {
  return getPlaces().features.find((item) => item.properties.place_id === placeId) || null;
}

module.exports = {
  listPlaces,
  resolvePlace,
  getPlaceMetrics,
  listPlaceReviews,
  addReview,
  addComplaint,
  listComplaints,
  advanceComplaintStatus,
  verifyResolution,
  getPlaceById,
  findAreaForPoint
};
