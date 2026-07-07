const { listComplaints } = require("./placeService");

function getSummary() {
  const complaints = listComplaints();

  return {
    total: complaints.length,
    pending: complaints.filter((c) => !["Resolved", "Closed"].includes(c.status)).length,
    resolved: complaints.filter((c) => ["Resolved", "Closed"].includes(c.status)).length,
    highPriority: complaints.filter((c) => c.severity === 3 && !["Resolved", "Closed"].includes(c.status)).length
  };
}

module.exports = { getSummary };
