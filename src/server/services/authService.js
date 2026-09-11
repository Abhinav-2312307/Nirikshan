import { connectToDatabase } from "../../../lib/mongodb.js";
import { getOfficers, getUsers, saveUsers } from "../repositories/dataRepository.js";

// Lightweight token encoding for session handling without heavy external JWT dependencies
export function createSessionToken(payload) {
  const data = JSON.stringify({
    ...payload,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  return Buffer.from(data).toString("base64url");
}

export function decodeSessionToken(token) {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.exp && parsed.exp < Date.now()) {
      return null; // Expired
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function authenticate({ email, password, role = "officer" }) {
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanPassword = (password || "").trim();

  if (!cleanEmail || !cleanPassword) {
    throw new Error("Email and password are required");
  }

  let db = null;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.warn("MongoDB connection fallback in authenticate:", err.message);
  }

  if (role === "officer") {
    let officer = null;
    if (db) {
      officer = await db.collection("officers").findOne({ 
        email: { $regex: new RegExp(`^${cleanEmail}$`, "i") } 
      });
    }

    // Fallback to local data repo if DB record not found
    if (!officer) {
      const allOfficers = getOfficers();
      officer = allOfficers.find(o => o.email.toLowerCase() === cleanEmail);
    }

    if (!officer) {
      throw new Error("No officer account found with this official email");
    }

    // Direct password match (admin123 in sample environment)
    if (officer.password !== cleanPassword) {
      throw new Error("Invalid official credentials or security PIN");
    }

    const sessionPayload = {
      user_id: officer.id,
      email: officer.email,
      name: officer.name,
      designation: officer.designation,
      department: officer.department,
      level: officer.level,
      badge: officer.badge,
      jurisdiction: officer.jurisdiction,
      superior_id: officer.superior_id,
      phone: officer.phone,
      role: "officer"
    };

    const token = createSessionToken(sessionPayload);
    return {
      token,
      officer: sessionPayload
    };
  } else {
    // Citizen role authentication
    let user = null;
    if (db) {
      user = await db.collection("users").findOne({ 
        email: { $regex: new RegExp(`^${cleanEmail}$`, "i") } 
      });
    }

    if (!user) {
      const allUsers = getUsers();
      user = allUsers.find(u => u.email.toLowerCase() === cleanEmail);
    }

    if (!user) {
      throw new Error("Citizen account not registered. Please sign up.");
    }

    if (user.password !== cleanPassword) {
      throw new Error("Invalid password");
    }

    const sessionPayload = {
      user_id: user.id,
      email: user.email,
      name: user.name,
      role: "citizen",
      ward: user.ward,
      city: user.city,
      address: user.address,
      phone: user.phone,
      trust_score: user.trust_score || 75
    };

    const token = createSessionToken(sessionPayload);
    return {
      token,
      user: sessionPayload
    };
  }
}

export async function registerCitizen(data) {
  const cleanEmail = (data.email || "").trim().toLowerCase();
  const cleanPassword = (data.password || "").trim();
  const name = (data.name || "").trim();

  if (!cleanEmail || !cleanPassword || !name) {
    throw new Error("Name, email, and password are required");
  }

  let db = null;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.warn("MongoDB connection fallback in registerCitizen:", err.message);
  }

  const existing = db ? await db.collection("users").findOne({ email: cleanEmail }) : null;
  if (existing) {
    throw new Error("An account is already registered with this email");
  }

  const newUser = {
    id: `USER-CIT-${Date.now().toString().slice(-4)}`,
    email: cleanEmail,
    password: cleanPassword,
    name,
    role: "citizen",
    phone: data.phone || "+91-98000-00000",
    address: data.address || "Lucknow / Kanpur",
    city: data.city || "Lucknow",
    ward: data.ward || "Ward 12 (Hazratganj Central)",
    trust_score: 80,
    created_at: new Date().toISOString()
  };

  if (db) {
    await db.collection("users").insertOne(newUser);
  } else {
    const users = getUsers();
    users.push(newUser);
    saveUsers(users);
  }

  const sessionPayload = {
    user_id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: "citizen",
    ward: newUser.ward,
    city: newUser.city,
    address: newUser.address,
    phone: newUser.phone,
    trust_score: newUser.trust_score
  };

  return {
    token: createSessionToken(sessionPayload),
    user: sessionPayload
  };
}

export async function getAllOfficersList() {
  try {
    const { db } = await connectToDatabase();
    const officers = await db.collection("officers").find({}).toArray();
    if (officers.length > 0) return officers;
  } catch (err) {
    console.warn("DB error in getAllOfficersList:", err.message);
  }
  return getOfficers();
}
