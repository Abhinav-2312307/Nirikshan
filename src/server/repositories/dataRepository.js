const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(fileName, fallback) {
  try {
    const filePath = path.join(DATA_DIR, fileName);
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(fileName, value) {
  const filePath = path.join(DATA_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function getAreas(level = "macro") {
  if (level === "india-states" || level === "states") {
    return readJson("india.states.geojson", { type: "FeatureCollection", features: [] });
  }
  if (level === "up-districts" || level === "districts") {
    return readJson("up.districts.geojson", { type: "FeatureCollection", features: [] });
  }
  if (level === "kanpur-subdistricts" || level === "subdistricts") {
    return readJson("kanpur.subdistricts.geojson", { type: "FeatureCollection", features: [] });
  }
  if (level === "micro") {
    return readJson("areas.micro.geojson", { type: "FeatureCollection", features: [] });
  }
  if (level === "submicro") {
    return readJson("areas.submicro.geojson", { type: "FeatureCollection", features: [] });
  }
  return readJson("areas.macro.geojson", { type: "FeatureCollection", features: [] });
}

function getAuthorities() {
  return readJson("authorities.json", []);
}

function saveAuthorities(value) {
  writeJson("authorities.json", value);
}

function getPlaces() {
  return readJson("places.geojson", { type: "FeatureCollection", features: [] });
}

function savePlaces(value) {
  writeJson("places.geojson", value);
}

function getReviews() {
  return readJson("reviews.json", []);
}

function saveReviews(value) {
  writeJson("reviews.json", value);
}

function getComplaints() {
  return readJson("complaints.json", []);
}

function saveComplaints(value) {
  writeJson("complaints.json", value);
}

module.exports = {
  getAreas,
  getAuthorities,
  saveAuthorities,
  getPlaces,
  savePlaces,
  getReviews,
  saveReviews,
  getComplaints,
  saveComplaints
};
