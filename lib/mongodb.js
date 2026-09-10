import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "nirikshan";

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable in .env.local");
}

let cachedClient = global._mongoClient || null;
let cachedDb = global._mongoDb || null;
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
  global._mongoClient = client;
  global._mongoDb = db;

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

  // 5. Seed Officers
  const officersCount = await db.collection("officers").countDocuments();
  if (officersCount === 0) {
    console.log("Seeding officers collection...");
    const filePath = path.join(DATA_DIR, "officers.json");
    if (fs.existsSync(filePath)) {
      const officers = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (officers.length > 0) {
        await db.collection("officers").insertMany(officers);
        await db.collection("officers").createIndex({ email: 1 }, { unique: true });
        console.log(`Successfully seeded ${officers.length} officers.`);
      }
    }
  }

  // 6. Seed Users (Citizens)
  const usersCount = await db.collection("users").countDocuments();
  if (usersCount === 0) {
    console.log("Seeding users collection...");
    const filePath = path.join(DATA_DIR, "users.json");
    if (fs.existsSync(filePath)) {
      const users = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (users.length > 0) {
        await db.collection("users").insertMany(users);
        await db.collection("users").createIndex({ email: 1 }, { unique: true });
        console.log(`Successfully seeded ${users.length} users.`);
      }
    }
  }

  // 7. Seed Fund Requests
  const fundCount = await db.collection("fund_requests").countDocuments();
  if (fundCount === 0) {
    console.log("Seeding fund_requests collection...");
    const filePath = path.join(DATA_DIR, "fund_requests.json");
    if (fs.existsSync(filePath)) {
      const funds = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (funds.length > 0) {
        await db.collection("fund_requests").insertMany(funds);
        console.log(`Successfully seeded ${funds.length} fund requests.`);
      }
    }
  }

  // 8. Seed Official Memos
  const memoCount = await db.collection("official_memos").countDocuments();
  if (memoCount === 0) {
    console.log("Seeding official_memos collection...");
    const filePath = path.join(DATA_DIR, "official_memos.json");
    if (fs.existsSync(filePath)) {
      const memos = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (memos.length > 0) {
        await db.collection("official_memos").insertMany(memos);
        console.log(`Successfully seeded ${memos.length} official memos.`);
      }
    }
  }

  // 9. Seed Officer Tasks
  const taskCount = await db.collection("officer_tasks").countDocuments();
  if (taskCount === 0) {
    console.log("Seeding officer_tasks collection...");
    const filePath = path.join(DATA_DIR, "officer_tasks.json");
    if (fs.existsSync(filePath)) {
      const tasks = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (tasks.length > 0) {
        await db.collection("officer_tasks").insertMany(tasks);
        console.log(`Successfully seeded ${tasks.length} officer tasks.`);
      }
    }
  }

  console.log("Database seed check finished.");
}
