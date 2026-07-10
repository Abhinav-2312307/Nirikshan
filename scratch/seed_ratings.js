const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const crypto = require("crypto");

// Resolve env file paths
const envPath = path.join(__dirname, "..", ".env.local");
const envBackupPath = path.join(__dirname, "..", ".env");
const activeEnvPath = fs.existsSync(envPath) ? envPath : envBackupPath;

if (!fs.existsSync(activeEnvPath)) {
  console.error("No .env or .env.local file found at workspace root!");
  process.exit(1);
}

// Manually parse env file to avoid dependency issues
const envContent = fs.readFileSync(activeEnvPath, "utf-8");
const mongoUriMatch = envContent.match(/MONGODB_URI="?([^"\n\r]+)"?/);
const dbNameMatch = envContent.match(/DB_NAME="?([^"\n\r]+)"?/);

const mongoUri = mongoUriMatch ? mongoUriMatch[1] : null;
const dbName = dbNameMatch ? dbNameMatch[1] : "nirikshan";

if (!mongoUri) {
  console.error("MONGODB_URI not found in active env file!");
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, "..", "src", "server", "data");

function readJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

const datasets = [
  "india.states.geojson",
  "up.districts.geojson",
  "kanpur.subdistricts.geojson",
  "areas.macro.geojson",
  "areas.micro.geojson",
  "areas.submicro.geojson"
];

// Realistic comments based on rating
const positiveComments = [
  "Excellent waste management. Garbage collection happens daily.",
  "Streetlights are fully operational. Safe for walking at night.",
  "Beautifully maintained parks and clean roads.",
  "Clean drinking water supply and proper drainage.",
  "Highly responsive authorities. Issues are resolved quickly."
];

const moderateComments = [
  "Road is generally fine, but cleaning could be more frequent.",
  "Streetlights are working, but some flicker.",
  "Acceptable drainage, minor water pooling during heavy rains.",
  "Water supply is regular but pressure is low.",
  "Average service. Takes some days to resolve complaints."
];

const negativeComments = [
  "Massive pothole on the main crossing. Very dangerous!",
  "Streetlights have been broken for months. Pitch dark at night.",
  "Severe drainage blockage. Filthy water overflowing onto streets.",
  "Irregular water supply. Water quality is very poor.",
  "No response from authorities. Garbage piling up everywhere."
];

function getCoordinates(feature) {
  const geom = feature.geometry;
  if (!geom) return [80.3319, 26.4499]; // default Kanpur
  if (geom.type === "Point") {
    return geom.coordinates;
  }
  if (geom.type === "Polygon") {
    return geom.coordinates[0][0];
  }
  if (geom.type === "MultiPolygon") {
    return geom.coordinates[0][0][0];
  }
  return [80.3319, 26.4499];
}

async function seed() {
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    console.log("Connected to MongoDB database.");
    const db = client.db(dbName);

    const reviewsCol = db.collection("reviews");
    const complaintsCol = db.collection("complaints");

    // Clear existing
    await reviewsCol.deleteMany({});
    await complaintsCol.deleteMany({});
    console.log("Cleared existing reviews and complaints collections.");

    const reviews = [];
    const complaints = [];

    const issueTypes = ["Pothole", "Streetlight", "Drainage", "Water", "Sewer", "Sanitation"];
    const authorities = [
      { id: "KNN", name: "Kanpur Nagar Nigam", dep: "Sanitation" },
      { id: "JAL", name: "Jal Kal Vibhag", dep: "Water Operations" },
      { id: "KDA", name: "Kanpur Development Authority", dep: "Road Projects" }
    ];

    for (const datasetName of datasets) {
      console.log(`Reading dataset: ${datasetName}`);
      const data = readJson(datasetName);
      const features = data.features || [];

      for (const feature of features) {
        const areaId = feature.properties.area_id;
        const name = feature.properties.name;
        const level = feature.properties.level || "area";

        if (!areaId) continue;

        // Choose a target grade: 4 = excellent, 3 = good, 2 = moderate, 1 = poor/critical
        // Let's randomize to get a beautiful distribution of colors on the map!
        const rand = Math.random();
        let ratingGrade;
        if (rand > 0.7) ratingGrade = 5; // Excellent
        else if (rand > 0.4) ratingGrade = 4; // Good
        else if (rand > 0.15) ratingGrade = 3; // Moderate
        else ratingGrade = 1; // Critical

        const numReviews = 2 + Math.floor(Math.random() * 2); // 2-3 reviews per area
        for (let i = 0; i < numReviews; i++) {
          let rating = ratingGrade;
          if (ratingGrade === 5) rating = 4 + Math.floor(Math.random() * 2);
          else if (ratingGrade === 4) rating = 3 + Math.floor(Math.random() * 2);
          else if (ratingGrade === 3) rating = 2 + Math.floor(Math.random() * 2);
          else rating = 1 + Math.floor(Math.random() * 2);

          let comment;
          if (rating >= 4) comment = positiveComments[Math.floor(Math.random() * positiveComments.length)];
          else if (rating === 3) comment = moderateComments[Math.floor(Math.random() * moderateComments.length)];
          else comment = negativeComments[Math.floor(Math.random() * negativeComments.length)];

          reviews.push({
            review_id: crypto.randomUUID(),
            place_id: areaId,
            user_id: `citizen_${Math.floor(Math.random() * 500)}`,
            rating,
            comment,
            tags: [],
            created_at: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString()
          });
        }

        // For moderate or critical areas, add some complaints
        if (ratingGrade <= 3) {
          const numComplaints = ratingGrade === 1 ? 2 + Math.floor(Math.random() * 2) : 1;
          const coords = getCoordinates(feature);

          for (let i = 0; i < numComplaints; i++) {
            const issueType = issueTypes[Math.floor(Math.random() * issueTypes.length)];
            const auth = authorities[Math.floor(Math.random() * authorities.length)];
            
            // Critical areas have open complaints. Moderate areas might have resolved ones.
            const status = ratingGrade === 1 
              ? (Math.random() > 0.3 ? "In Progress" : "Submitted") 
              : "Resolved";

            const desc = negativeComments[Math.floor(Math.random() * negativeComments.length)];

            complaints.push({
              complaint_id: crypto.randomUUID(),
              place_id: areaId,
              place_name: name,
              place_type: level,
              area_id: areaId,
              authority_id: auth.id,
              authority: auth.name,
              department: auth.dep,
              issue_type: issueType,
              severity: ratingGrade === 1 ? 3 : 2,
              description: desc,
              latitude: coords[1],
              longitude: coords[0],
              location: {
                type: "Point",
                coordinates: [coords[0], coords[1]]
              },
              status,
              disputed_jurisdiction: Math.random() > 0.85,
              assigned_authorities: [
                { authority_id: auth.id, name: auth.name, department: auth.dep }
              ],
              duplicate_of: null,
              is_duplicate: false,
              verification_status: "Pending",
              reopened_count: 0,
              user_trust_score: 80,
              ai_validation: {
                profanity_flagged: false,
                image_relevant: true,
                face_blurred: true,
                exif_stripped: true
              },
              created_at: new Date(Date.now() - Math.random() * 15 * 86400000).toISOString(),
              updated_at: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString()
            });
          }
        }
      }
    }

    if (reviews.length) {
      await reviewsCol.insertMany(reviews);
      console.log(`Successfully seeded ${reviews.length} reviews.`);
    }
    if (complaints.length) {
      await complaintsCol.insertMany(complaints);
      console.log(`Successfully seeded ${complaints.length} complaints.`);
    }

    console.log("Database seed completed successfully!");
  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    await client.close();
  }
}

seed();
