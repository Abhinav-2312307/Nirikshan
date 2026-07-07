const express = require("express");
const { listComplaints, advanceComplaintStatus, verifyResolution } = require("../services/placeService");
const { getAuthorities, getComplaints, saveComplaints } = require("../repositories/dataRepository");

const router = express.Router();

// List complaints (allows filtering by place, area, authority, moderation status)
router.get("/", (req, res) => {
  const include_moderation = req.query.include_moderation === "true";
  const data = listComplaints({
    place_id: req.query.place_id,
    area_id: req.query.area_id,
    authority_id: req.query.authority_id,
    include_moderation
  });
  res.json(data);
});

// Update complaint status (used by authorities)
router.patch("/:id/status", (req, res) => {
  try {
    const updated = advanceComplaintStatus(req.params.id, req.body?.status);
    res.json(updated);
  } catch (error) {
    if (error.message === "not_found") return res.status(404).json({ error: "Complaint not found" });
    if (error.message === "invalid_status") return res.status(400).json({ error: "Invalid status" });
    if (error.message === "terminal_status") return res.status(400).json({ error: "Already closed" });
    return res.status(500).json({ error: "Could not update complaint" });
  }
});

// Citizen Verification: Confirm or Dispute a resolved complaint
router.post("/:id/verify", (req, res) => {
  try {
    const { outcome } = req.body || {};
    if (!outcome) return res.status(400).json({ error: "outcome is required (Confirmed or Disputed)" });

    const updated = verifyResolution(req.params.id, outcome);
    res.json(updated);
  } catch (error) {
    if (error.message === "not_found") return res.status(404).json({ error: "Complaint not found" });
    if (error.message === "not_resolved") return res.status(400).json({ error: "Complaint is not resolved yet" });
    if (error.message === "invalid_outcome") return res.status(400).json({ error: "Invalid verification outcome" });
    return res.status(500).json({ error: error.message });
  }
});

// Community Flagging (dock trust score of the submitter and queue for moderation if flags count >= 3)
router.post("/:id/flag", (req, res) => {
  try {
    const complaints = getComplaints();
    const complaint = complaints.find(c => c.complaint_id === req.params.id);
    if (!complaint) return res.status(404).json({ error: "Complaint not found" });

    complaint.flags_count = (complaint.flags_count || 0) + 1;
    complaint.updated_at = new Date().toISOString();

    // If flagged by community multiple times, push to moderation
    if (complaint.flags_count >= 3 && complaint.status !== "Moderation") {
      complaint.status = "Moderation";
    }

    saveComplaints(complaints);
    res.json({ ok: true, flags_count: complaint.flags_count, status: complaint.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export complaints data as CSV
router.get("/export", (req, res) => {
  try {
    const complaints = listComplaints({ include_moderation: true });
    
    // Build CSV content
    const headers = [
      "complaint_id", "place_name", "area_id", "authority", "issue_type", 
      "severity", "description", "latitude", "longitude", "status", 
      "disputed_jurisdiction", "verification_status", "reopened_count", "created_at"
    ];

    const csvRows = [headers.join(",")];
    for (const c of complaints) {
      const values = headers.map(header => {
        let val = c[header] !== undefined ? c[header] : "";
        if (typeof val === "string") {
          // Escape quotes and wrap in quotes
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvRows.push(values.join(","));
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="civic_complaints_export.csv"');
    res.status(200).send(csvRows.join("\n"));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch authorities list with their metrics
router.get("/authorities", (req, res) => {
  try {
    const authorities = getAuthorities();
    const complaints = getComplaints();

    // Dynamically calculate actual dashboard metrics for each authority if not set
    const data = authorities.map(auth => {
      const authId = auth.authority_id;
      const authComplaints = complaints.filter(c => {
        return c.authority_id === authId || c.assigned_authorities?.some(a => a.authority_id === authId);
      });
      
      const total = authComplaints.length;
      const resolved = authComplaints.filter(c => ["Resolved", "Closed"].includes(c.status)).length;
      const disputed = authComplaints.filter(c => c.verification_status === "Disputed").length;
      const open = authComplaints.filter(c => !["Resolved", "Closed"].includes(c.status) && c.status !== "Moderation").length;
      
      const defaultScore = auth.metrics?.score || (total ? Math.round(((resolved - disputed * 0.5) / Math.max(1, total)) * 100) : 75);
      const score = Math.max(0, Math.min(100, defaultScore));

      return {
        ...auth,
        metrics: {
          score,
          total_complaints: total,
          resolved_complaints: resolved,
          disputed_complaints: disputed,
          open_complaints: open
        }
      };
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
