import { listComplaints } from "./placeService";

export async function getSummary() {
  const complaints = await listComplaints();

  return {
    total: complaints.length,
    pending: complaints.filter((c) => !["Resolved", "Closed"].includes(c.status)).length,
    resolved: complaints.filter((c) => ["Resolved", "Closed"].includes(c.status)).length,
    highPriority: complaints.filter((c) => c.severity === 3 && !["Resolved", "Closed"].includes(c.status)).length
  };
}
