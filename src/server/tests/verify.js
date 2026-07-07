const http = require("http");

const PORT = 4000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = BASE_URL + path;
    const reqOpts = {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    };

    const req = http.request(url, reqOpts, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        const isJson = res.headers["content-type"]?.includes("application/json");
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: isJson ? JSON.parse(body) : body
        });
      });
    });

    req.on("error", reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("=== STARTING CIVIC PLATFORM API VALIDATION ===");

  try {
    // 1. Health check
    console.log("\n1. Testing /api/health...");
    const health = await request("/api/health");
    if (health.statusCode !== 200 || !health.data.ok) {
      throw new Error("Health check failed");
    }
    console.log("✓ Health check ok:", health.data);

    // 2. Areas boundary query
    console.log("\n2. Testing /api/areas?level=states...");
    const states = await request("/api/areas?level=states");
    if (states.statusCode !== 200 || states.data.type !== "FeatureCollection") {
      throw new Error("States boundaries fetch failed");
    }
    console.log(`✓ Fetched ${states.data.features.length} state boundaries.`);

    // 3. Authority metrics
    console.log("\n3. Testing /api/complaints/authorities...");
    const auths = await request("/api/complaints/authorities");
    if (auths.statusCode !== 200 || !Array.isArray(auths.data)) {
      throw new Error("Authorities metrics endpoint failed");
    }
    console.log("✓ Authorities rankings fetched.");

    // 4. Submit a valid complaint and verify automatic multi-authority routing
    console.log("\n4. Submitting a new complaint at Naubasta Main Road (Pothole)...");
    const testComplaintPayload = {
      place_name: "Naubasta Cross Road",
      place_type: "road",
      address: "Chowk Crossing, Naubasta",
      issue_type: "Pothole",
      severity: 3,
      description: "Severe potholes hindering traffic near the intersection.",
      latitude: 26.4194,
      longitude: 80.3054,
      user_trust_score: 80 // High trust should bypass moderation
    };

    const submitRes = await request("/api/places/PL_ROAD_001/complaints", {
      method: "POST",
      body: testComplaintPayload
    });

    if (submitRes.statusCode !== 201) {
      throw new Error(`Failed to submit complaint: ${JSON.stringify(submitRes.data)}`);
    }

    const complaint = submitRes.data;
    console.log("✓ Complaint submitted successfully.");
    console.log(`  ID: ${complaint.complaint_id}`);
    console.log(`  Status: ${complaint.status}`);
    console.log(`  Disputed Jurisdiction Flag: ${complaint.disputed_jurisdiction}`);
    console.log("  Assigned Authorities:", complaint.assigned_authorities.map(a => `${a.authority_id} (${a.department})`));

    if (!complaint.disputed_jurisdiction || complaint.assigned_authorities.length <= 1) {
      throw new Error("Multi-authority overlapping jurisdiction routing failed");
    }

    // 5. Test AI duplicate detection
    console.log("\n5. Submitting duplicate complaint within 150m radius...");
    const duplicateRes = await request("/api/places/PL_ROAD_001/complaints", {
      method: "POST",
      body: {
        ...testComplaintPayload,
        description: "Another duplicate pothole report right next to it."
      }
    });

    if (duplicateRes.statusCode !== 201 || !duplicateRes.data.is_duplicate) {
      throw new Error("AI duplicate check failed to trigger");
    }
    console.log(`✓ Duplicate detection ok. Flagged duplicate: ${duplicateRes.data.is_duplicate}, Linked ID: ${duplicateRes.data.duplicate_of}`);

    // 6. Test NLP Moderation routing for spam / low trust scores
    console.log("\n6. Submitting spam complaint (expecting Moderation queue)...");
    const spamRes = await request("/api/places/PL_ROAD_001/complaints", {
      method: "POST",
      body: {
        ...testComplaintPayload,
        description: "This is a spam report with junk content.",
        user_trust_score: 20 // Low trust triggers moderation
      }
    });

    if (spamRes.statusCode !== 201 || spamRes.data.status !== "Moderation") {
      throw new Error(`Spam complaint status should be Moderation, got: ${spamRes.data.status}`);
    }
    console.log("✓ Spam detection ok. Routed to:", spamRes.data.status);

    // 7. Test Citizen Verification Loop (Confirm / Dispute resolution)
    console.log("\n7. Simulating resolution and verification loop...");
    
    // Advance status to Resolved: Submitted -> Verified -> Assigned -> In Progress -> Resolved
    console.log("  Advancing status to Resolved...");
    await request(`/api/complaints/${complaint.complaint_id}/status`, { method: "PATCH" }); // Verified
    await request(`/api/complaints/${complaint.complaint_id}/status`, { method: "PATCH" }); // Assigned
    await request(`/api/complaints/${complaint.complaint_id}/status`, { method: "PATCH" }); // In Progress
    const resolvedRes = await request(`/api/complaints/${complaint.complaint_id}/status`, { 
      method: "PATCH",
      body: { status: "Resolved" } 
    });

    if (resolvedRes.data.status !== "Resolved") {
      throw new Error("Failed to advance complaint to Resolved");
    }

    // Citizen disputes resolution
    console.log("  Simulating citizen DISPUTE...");
    const disputeRes = await request(`/api/complaints/${complaint.complaint_id}/verify`, {
      method: "POST",
      body: { outcome: "Disputed" }
    });

    if (disputeRes.data.status !== "In Progress" || disputeRes.data.verification_status !== "Disputed") {
      throw new Error("Dispute verification failed to reopen ticket");
    }
    console.log(`✓ Dispute loop ok. Status reset to: ${disputeRes.data.status}, Verification: ${disputeRes.data.verification_status}`);

    // Re-resolve and confirm resolution
    console.log("  Re-resolving and simulating citizen CONFIRM...");
    await request(`/api/complaints/${complaint.complaint_id}/status`, { 
      method: "PATCH",
      body: { status: "Resolved" } 
    });

    const confirmRes = await request(`/api/complaints/${complaint.complaint_id}/verify`, {
      method: "POST",
      body: { outcome: "Confirmed" }
    });

    if (confirmRes.data.status !== "Closed" || confirmRes.data.verification_status !== "Confirmed") {
      throw new Error("Confirmation verification failed to close ticket");
    }
    console.log(`✓ Confirm loop ok. Status set to: ${confirmRes.data.status}, Verification: ${confirmRes.data.verification_status}`);

    // 8. CSV export validation
    console.log("\n8. Testing CSV data export...");
    const csvExport = await request("/api/complaints/export");
    if (csvExport.statusCode !== 200 || !csvExport.data.includes("complaint_id")) {
      throw new Error("CSV Export failed");
    }
    console.log("✓ CSV data export validation ok.");

    console.log("\n=== ALL TEST CHECKS PASSED SUCCESSFULLY! ===");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ VALIDATION TEST FAILED:");
    console.error(error.message);
    process.exit(1);
  }
}

runTests();
