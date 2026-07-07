function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi + Number.EPSILON) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

function haversineMeters(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const lat1 = a[1];
  const lon1 = a[0];
  const lat2 = b[1];
  const lon2 = b[0];

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;

  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function centroidOfPolygon(polygon) {
  let x = 0;
  let y = 0;
  for (const p of polygon) {
    x += p[0];
    y += p[1];
  }
  return [x / polygon.length, y / polygon.length];
}

function centerOfLine(line) {
  if (!line.length) return [0, 0];
  return line[Math.floor(line.length / 2)];
}

function centerOfFeature(feature) {
  const geometry = feature.geometry || {};
  if (geometry.type === "Point") return geometry.coordinates;
  if (geometry.type === "LineString") return centerOfLine(geometry.coordinates || []);
  if (geometry.type === "Polygon") return centroidOfPolygon((geometry.coordinates && geometry.coordinates[0]) || []);
  return [0, 0];
}

function pointLineDistanceMeters(point, line) {
  let minMeters = Number.POSITIVE_INFINITY;

  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const projected = projectPointToSegment(point, a, b);
    const d = haversineMeters(point, projected);
    if (d < minMeters) minMeters = d;
  }

  return minMeters;
}

function projectPointToSegment(p, a, b) {
  const apx = p[0] - a[0];
  const apy = p[1] - a[1];
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const ab2 = abx * abx + aby * aby;
  const dot = apx * abx + apy * aby;
  const t = ab2 === 0 ? 0 : Math.max(0, Math.min(1, dot / ab2));
  return [a[0] + abx * t, a[1] + aby * t];
}

module.exports = {
  pointInPolygon,
  haversineMeters,
  centroidOfPolygon,
  pointLineDistanceMeters,
  centerOfFeature
};
