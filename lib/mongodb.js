import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "nirikshan";

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable in .env.local");
}

let cachedClient = null;
let cachedDb = null;
let isSeeding = false;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  // Run seeding in background if not already running
  if (!isSeeding) {
    isSeeding = true;
    seedDatabaseIfEmpty(db).catch(err => {
      console.error("Database seeding failed:", err);
    }).finally(() => {
      isSeeding = false;
    });
  }

  return { client, db };
}

async function seedDatabaseIfEmpty(db) {
  console.log("Checking if database needs seeding...");
  
  // We'll read from our project server data directory
  // In Next.js, process.cwd() is the root of the project
  const DATA_DIR = path.join(process.cwd(), "src", "server", "data");

  // 1. Seed Places
  const placesCount = await db.collection("places").countDocuments();
  if (placesCount === 0) {
    console.log("Seeding places collection...");
    const filePath = path.join(DATA_DIR, "places.geojson");
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const features = data.features || [];
      if (features.length > 0) {
        // Map places to mongo documents
        const docs = features.map(f => ({
          ...f,
          // Add a location key in standard GeoJSON format for geospatial indexing
          location: f.geometry
        }));
        await db.collection("places").insertMany(docs);
        await db.collection("places").createIndex({ location: "2dsphere" });
        console.log(`Successfully seeded ${features.length} places.`);
      }
    }
  }

  // 2. Seed Complaints
  const complaintsCount = await db.collection("complaints").countDocuments();
  if (complaintsCount === 0) {
    console.log("Seeding complaints collection...");
    const filePath = path.join(DATA_DIR, "complaints.json");
    if (fs.existsSync(filePath)) {
      const complaints = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (complaints.length > 0) {
        const docs = complaints.map(c => ({
          ...c,
          location: {
            type: "Point",
            coordinates: [Number(c.longitude), Number(c.latitude)]
          }
        }));
        await db.collection("complaints").insertMany(docs);
        await db.collection("complaints").createIndex({ location: "2dsphere" });
        console.log(`Successfully seeded ${complaints.length} complaints.`);
      }
    }
  }

  // 3. Seed Reviews
  const reviewsCount = await db.collection("reviews").countDocuments();
  if (reviewsCount === 0) {
    console.log("Seeding reviews collection...");
    const filePath = path.join(DATA_DIR, "reviews.json");
    if (fs.existsSync(filePath)) {
      const reviews = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (reviews.length > 0) {
        await db.collection("reviews").insertMany(reviews);
        console.log(`Successfully seeded ${reviews.length} reviews.`);
      }
    }
  }

  // 4. Seed Authorities
  const authCount = await db.collection("authorities").countDocuments();
  if (authCount === 0) {
    console.log("Seeding authorities collection...");
    const filePath = path.join(DATA_DIR, "authorities.json");
    if (fs.existsSync(filePath)) {
      const auths = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (auths.length > 0) {
        await db.collection("authorities").insertMany(auths);
        console.log(`Successfully seeded ${auths.length} authorities.`);
      }
    }
  }

  console.log("Database seed check finished.");
}
