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

const positiveComments = [
  "Excellent waste management. LMC garbage collection vehicle arrives every morning on time.",
  "Streetlights are fully operational across the entire sector. Very safe for night walks.",
  "Well-maintained green parks and clean arterial roads. Great initiative by LDA.",
  "Clean drinking water supply and proper underground drainage system.",
  "Highly responsive Lucknow Nagar Nigam team. Street issues resolved in 48 hours."
];

const moderateComments = [
  "Main sector road is in decent condition, but inner lanes need periodic cleaning.",
  "Streetlights are functioning, though a couple of LED units flicker.",
  "Acceptable monsoon storm drainage; minor water pooling near market gates.",
  "Municipal water supply is regular, though pressure dips during morning peak hours.",
  "Average municipal service. Pothole repairs take a few days after complaint registration."
];

const negativeComments = [
  "Dangerous pothole cluster near the main market roundabout. Urgent LDA repair needed!",
  "Streetlights have been out for over two weeks. Commuters facing safety issues.",
  "Severe drainage overflow during recent rain. Filthy water logged near colony gate.",
  "Irregular water supply and low line pressure for the past few days.",
  "LMC sanitation truck skipped collection this week. Garbage piling up in bin bays."
];

function getCoordinates(feature) {
  const geom = feature.geometry;
  if (!geom) return [80.9462, 26.8467]; // default Lucknow center
  if (geom.type === "Point") {
    return geom.coordinates;
  }
  if (geom.type === "Polygon") {
    const ring = geom.coordinates[0];
    let sumX = 0, sumY = 0;
    for (const pt of ring) {
      sumX += pt[0];
      sumY += pt[1];
    }
    return [sumX / ring.length, sumY / ring.length];
  }
  if (geom.type === "MultiPolygon") {
    const ring = geom.coordinates[0][0];
    let sumX = 0, sumY = 0;
    for (const pt of ring) {
      sumX += pt[0];
      sumY += pt[1];
    }
    return [sumX / ring.length, sumY / ring.length];
  }
  return [80.9462, 26.8467];
}

async function seedLucknow() {
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    console.log("Connected to MongoDB for Lucknow data seeding.");
    const db = client.db(dbName);

    const reviewsCol = db.collection("reviews");
    const complaintsCol = db.collection("complaints");

    // Remove any previous Lucknow reviews/complaints to avoid duplicates
    await reviewsCol.deleteMany({ place_id: { $regex: "^(WARD_LKO_|SUBDIST_LUCKNOW|SUBDIST_BAKSHI|SUBDIST_MOHANLALGANJ)" } });
    await complaintsCol.deleteMany({ area_id: { $regex: "^(WARD_LKO_|SUBDIST_LUCKNOW|SUBDIST_BAKSHI|SUBDIST_MOHANLALGANJ)" } });
    console.log("Cleaned prior Lucknow reviews and complaints.");

    const reviews = [];
    const complaints = [];

    const issueTypes = ["Pothole", "Streetlight", "Water", "Sewer", "Garbage", "Safety"];
    const lkoAuthorities = [
      { id: "LNN", name: "Lucknow Nagar Nigam", dep: "Solid Waste & Sanitation" },
      { id: "LNN", name: "Lucknow Nagar Nigam", dep: "Roads & Civil Maintenance" },
      { id: "LDA", name: "Lucknow Development Authority", dep: "Master Road Projects" },
      { id: "LDA", name: "Lucknow Development Authority", dep: "Smart City Lighting" },
      { id: "JAL", name: "Jal Sansthan Lucknow", dep: "Municipal Water Services" }
    ];

    const datasets = [
      "kanpur.subdistricts.geojson",
      "areas.macro.geojson",
      "areas.micro.geojson",
      "areas.submicro.geojson"
    ];

    for (const dsName of datasets) {
      const data = readJson(dsName);
      const lkoFeatures = (data.features || []).filter(f => {
        const aId = f.properties.area_id || "";
        const city = f.properties.city || "";
        return city === "Lucknow" || aId.startsWith("WARD_LKO_") || aId.includes("LUCKNOW") || aId.includes("BAKSHI") || aId.includes("MOHANLALGANJ");
      });

      console.log(`Dataset ${dsName}: found ${lkoFeatures.length} Lucknow features.`);

      for (const feature of lkoFeatures) {
        const areaId = feature.properties.area_id;
        const name = feature.properties.name;
        const level = feature.properties.level || "area";

        // Pseudo-random deterministic grade based on string hash for realistic distribution
        let hash = 0;
        for (let i = 0; i < areaId.length; i++) {
          hash = (hash << 5) - hash + areaId.charCodeAt(i);
          hash |= 0;
        }
        const rand = Math.abs(hash % 100) / 100;

        let ratingGrade;
        if (rand > 0.65) ratingGrade = 5;      // Well-maintained (80+)
        else if (rand > 0.35) ratingGrade = 4; // Acceptable (60-80)
        else if (rand > 0.15) ratingGrade = 3; // Moderate (50-60)
        else ratingGrade = 1;                  // Critical (<50)

        const numReviews = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numReviews; i++) {
          let rating = ratingGrade;
          if (ratingGrade === 5) rating = 4 + (i % 2);
          else if (ratingGrade === 4) rating = 3 + (i % 2);
          else if (ratingGrade === 3) rating = 2 + (i % 2);
          else rating = 1 + (i % 2);

          let comment;
          if (rating >= 4) comment = positiveComments[Math.floor(Math.random() * positiveComments.length)];
          else if (rating === 3) comment = moderateComments[Math.floor(Math.random() * moderateComments.length)];
          else comment = negativeComments[Math.floor(Math.random() * negativeComments.length)];

          reviews.push({
            review_id: crypto.randomUUID(),
            place_id: areaId,
            user_id: `citizen_lko_${Math.floor(Math.random() * 300)}`,
            rating,
            comment,
            tags: ["Lucknow", level],
            created_at: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString()
          });
        }

        // Add complaints for realistic heatmap and open issues
        if (ratingGrade <= 4) {
          const numComplaints = ratingGrade === 1 ? 2 : 1;
          const coords = getCoordinates(feature);

          for (let i = 0; i < numComplaints; i++) {
            const issueType = issueTypes[Math.floor(Math.random() * issueTypes.length)];
            const auth = lkoAuthorities[Math.floor(Math.random() * lkoAuthorities.length)];
            const status = ratingGrade === 1 
              ? (Math.random() > 0.4 ? "In Progress" : "Submitted") 
              : (ratingGrade === 4 ? "Resolved" : "In Progress");

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
              disputed_jurisdiction: Math.random() > 0.88,
              assigned_authorities: [
                { authority_id: auth.id, name: auth.name, department: auth.dep }
              ],
              duplicate_of: null,
              is_duplicate: false,
              verification_status: "Pending",
              reopened_count: 0,
              user_trust_score: 85,
              ai_validation: {
                profanity_flagged: false,
                image_relevant: true,
                face_blurred: true,
                exif_stripped: true
              },
              created_at: new Date(Date.now() - Math.random() * 15 * 86400000).toISOString(),
              updated_at: new Date(Date.now() - Math.random() * 5 * 86400000).toISOString()
            });
          }
        }
      }
    }

    if (reviews.length) {
      await reviewsCol.insertMany(reviews);
      console.log(`Successfully seeded ${reviews.length} reviews for Lucknow.`);
    }
    if (complaints.length) {
      await complaintsCol.insertMany(complaints);
      console.log(`Successfully seeded ${complaints.length} complaints for Lucknow.`);
    }

    console.log("Lucknow seeding completed successfully!");
  } catch (err) {
    console.error("Lucknow seeding failed:", err);
  } finally {
    await client.close();
  }
}

seedLucknow();
