const express = require("express");
const {
  listPlaces,
  resolvePlace,
  getPlaceMetrics,
  listPlaceReviews,
  addReview,
  addComplaint,
  getPlaceById,
  findAreaForPoint
} = require("../services/placeService");

const router = express.Router();

router.get("/", (req, res) => {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 200));
  res.json(listPlaces({ q: req.query.q, type: req.query.type, limit }));
});

router.get("/resolve", (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const resolved = resolvePlace(lat, lng);
  const metrics = getPlaceMetrics(resolved.place.properties.place_id);
  const area = findAreaForPoint(lat, lng);

  res.json({
    ...resolved,
    metrics,
    area: area
      ? {
          area_id: area.properties.area_id,
          name: area.properties.name,
          authority: area.properties.authority || 
                     (area.properties.level === "state" ? "State Government" : 
                      area.properties.level === "district" ? "District Administration" : 
                      area.properties.level === "subdistrict" ? "Tehsil Office" : "Local Authority"),
          city: area.properties.city
        }
      : null
  });
});

router.get("/:id", (req, res) => {
  const place = getPlaceById(req.params.id);
  if (!place) {
    return res.status(404).json({ error: "Place not found" });
  }

  return res.json({ place, metrics: getPlaceMetrics(req.params.id) });
});

router.get("/:id/reviews", (req, res) => {
  res.json(listPlaceReviews(req.params.id));
});

router.post("/:id/reviews", (req, res) => {
  try {
    const created = addReview(req.params.id, req.body || {});
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/complaints", (req, res) => {
  const payload = req.body || {};
  const lat = Number(payload.latitude);
  const lng = Number(payload.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !payload.issue_type || !payload.description) {
    return res.status(400).json({
      error: "latitude, longitude, issue_type and description are required"
    });
  }

  const place = getPlaceById(req.params.id);
  const placeFeature = place || {
    type: "Feature",
    properties: {
      place_id: req.params.id,
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

  const created = addComplaint(placeFeature, payload);
  return res.status(201).json(created);
});

module.exports = router;
