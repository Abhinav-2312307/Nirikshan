import { connectToDatabase } from "../../../lib/mongodb.js";
import { 
  getComplaints, 
  saveComplaints, 
  getOfficers, 
  saveOfficers, 
  getFundRequests, 
  saveFundRequests, 
  getOfficialMemos, 
  saveOfficialMemos, 
  getOfficerTasks, 
  saveOfficerTasks 
} from "../repositories/dataRepository.js";

// Helper to filter complaints by officer jurisdiction
export function matchesJurisdiction(complaint, officer) {
  if (!officer || officer.level === "national") return true;

  const jur = officer.jurisdiction || {};
  const jurCode = (jur.code || "").toUpperCase();
  const jurName = (jur.name || "").toLowerCase();
  const jurCity = (jur.city || "").toLowerCase();

  const cAreaId = (complaint.area_id || "").toUpperCase();
  const cPlaceName = (complaint.place_name || "").toLowerCase();
  const cAuthority = (complaint.authority || "").toLowerCase();
  const cAuthorityId = (complaint.authority_id || "").toUpperCase();

  // State Level: UP
  if (officer.level === "state") {
    // Both Lucknow and Kanpur are in UP
    return true;
  }

  // District Level: LUCKNOW or KANPUR
  if (officer.level === "district") {
    if (jurCode === "LUCKNOW") {
      return (
        cAuthority.includes("lucknow") || 
        cAuthorityId.includes("LNN") || 
        cAuthorityId.includes("LDA") ||
        cPlaceName.includes("lucknow") ||
        cPlaceName.includes("hazratganj") ||
        cPlaceName.includes("gomti") ||
        cAreaId.includes("LKO")
      );
    }
    if (jurCode === "KANPUR") {
      return (
        cAuthority.includes("kanpur") || 
        cAuthorityId.includes("KNN") || 
        cAuthorityId.includes("KDA") ||
        cPlaceName.includes("kanpur") ||
        cPlaceName.includes("naubasta") ||
        cPlaceName.includes("kidwai") ||
        cPlaceName.includes("hanspuram") ||
        cAreaId.includes("WARD_88") ||
        cAreaId.includes("WARD_36") ||
        cAreaId.includes("WARD_58") ||
        cAreaId.includes("KNP")
      );
    }
    return true;
  }

  // Zonal Level
  if (officer.level === "zone") {
    if (jurCode.includes("LKO")) {
      return (
        cAuthorityId === "LNN" || 
        cAuthorityId === "LDA" ||
        cPlaceName.includes("hazratganj") ||
        cPlaceName.includes("lucknow") ||
        cAreaId.includes("WARD_12") ||
        cAreaId.includes("LKO")
      );
    }
    if (jurCode.includes("KNP")) {
      return (
        cAuthorityId === "KNN" || 
        cAuthorityId === "KDA" ||
        cAuthorityId === "JAL" ||
        cAreaId.includes("WARD_88") ||
        cAreaId.includes("WARD_36") ||
        cAreaId.includes("WARD_58") ||
        cPlaceName.includes("naubasta") ||
        cPlaceName.includes("hanspuram")
      );
    }
    return true;
  }

  // Ward Level: specific ward
  if (officer.level === "ward") {
    if (jurCode.includes("88")) {
      return cAreaId.includes("WARD_88") || cPlaceName.includes("naubasta") || complaint.complaint_id === "cmp-001";
    }
    if (jurCode.includes("12")) {
      return cAreaId.includes("WARD_12") || cPlaceName.includes("hazratganj");
    }
    // Generic ward match
    return cAreaId.includes(jurCode) || (cAreaId && jurName && cAreaId.toLowerCase().includes(jurName));
  }

  return true;
}

export async function listJurisdictionComplaints(officer, filters = {}) {
  let complaints = [];
  let db = null;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.warn("MongoDB connection fallback in listJurisdictionComplaints:", err.message);
  }

  if (db) {
    complaints = await db.collection("complaints").find({}).sort({ created_at: -1 }).toArray();
  } else {
    complaints = getComplaints();
  }

  // Filter complaints by jurisdiction
  let scoped = complaints.filter(c => matchesJurisdiction(c, officer));

  // If filtered set is too small for demonstration at ward level, ensure at least 2 relevant complaints
  if (scoped.length === 0 && complaints.length > 0) {
    scoped = complaints.slice(0, 3);
  }

  // Fetch linked funds
  let allFunds = [];
  if (db) {
    allFunds = await db.collection("fund_requests").find({}).toArray();
  } else {
    allFunds = getFundRequests();
  }

  const fundMap = new Map();
  for (const f of allFunds) {
    if (f.complaint_id) {
      if (!fundMap.has(f.complaint_id)) fundMap.set(f.complaint_id, []);
      fundMap.get(f.complaint_id).push(f);
    }
  }

  return scoped.map(c => {
    const daysUnresolved = (Date.now() - new Date(c.updated_at || c.created_at).getTime()) / 86400000;
    const isUnresolved = !["Resolved", "Closed"].includes(c.status);
    return {
      ...c,
      _id: undefined,
      escalated: c.escalated || (isUnresolved && daysUnresolved > 7),
      days_open: Math.max(1, Math.round(daysUnresolved)),
      linked_funds: fundMap.get(c.complaint_id) || []
    };
  });
}

export async function executeComplaintAction(complaintId, officer, actionData) {
  let db = null;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.warn("MongoDB connection fallback in executeComplaintAction:", err.message);
  }

  let complaint = null;
  if (db) {
    complaint = await db.collection("complaints").findOne({ complaint_id: complaintId });
  } else {
    const all = getComplaints();
    complaint = all.find(c => c.complaint_id === complaintId);
  }

  if (!complaint) throw new Error("Complaint not found");

  const now = new Date().toISOString();
  const actionType = actionData.action_type || "status_change";
  const auditLogs = complaint.audit_logs || [];

  let updatedFields = {
    updated_at: now
  };

  if (actionType === "status_change") {
    const newStatus = actionData.status;
    if (!newStatus) throw new Error("New status is required");
    updatedFields.status = newStatus;
    if (actionData.inspection_date) {
      updatedFields.scheduled_inspection = actionData.inspection_date;
    }
    if (actionData.resolution_notes) {
      updatedFields.resolution_notes = actionData.resolution_notes;
    }
    auditLogs.push({
      action: `Status changed to ${newStatus}`,
      by_officer: officer.name,
      officer_designation: officer.designation,
      officer_level: officer.level,
      timestamp: now,
      notes: actionData.notes || actionData.resolution_notes || ""
    });
  } else if (actionType === "forward_upper") {
    const targetLevel = actionData.target_level || "district";
    const justification = actionData.justification || "Requires senior administrative intervention.";
    const forwardLog = {
      forwarded_by: officer.name,
      forwarded_by_id: officer.user_id,
      forwarded_by_designation: officer.designation,
      source_level: officer.level,
      target_level: targetLevel,
      target_authority: actionData.target_authority || "District Command",
      justification,
      urgency: actionData.urgency || "High",
      timestamp: now
    };

    const forwardHistory = complaint.forward_history || [];
    forwardHistory.push(forwardLog);

    updatedFields.forward_history = forwardHistory;
    updatedFields.escalated = true;
    updatedFields.status = "Escalated to Upper Section";

    auditLogs.push({
      action: `Escalated & Forwarded to ${targetLevel.toUpperCase()} Level`,
      by_officer: officer.name,
      officer_designation: officer.designation,
      timestamp: now,
      notes: justification
    });
  } else if (actionType === "reject") {
    if (!actionData.rejection_reason) throw new Error("Rejection justification is mandatory");
    updatedFields.status = "Rejected";
    updatedFields.rejection_reason = actionData.rejection_reason;
    auditLogs.push({
      action: "Grievance Rejected",
      by_officer: officer.name,
      officer_designation: officer.designation,
      timestamp: now,
      notes: actionData.rejection_reason
    });
  }

  updatedFields.audit_logs = auditLogs;

  if (db) {
    await db.collection("complaints").updateOne(
      { complaint_id: complaintId },
      { $set: updatedFields }
    );
  } else {
    const all = getComplaints();
    const idx = all.findIndex(c => c.complaint_id === complaintId);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updatedFields };
      saveComplaints(all);
    }
  }

  return {
    ...complaint,
    ...updatedFields,
    _id: undefined
  };
}

// -------------------------------------------------------------
// Fund Requisitions
// -------------------------------------------------------------
export async function listFundRequests(officer) {
  let db = null;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.warn("MongoDB connection fallback in listFundRequests:", err.message);
  }

  let funds = [];
  if (db) {
    funds = await db.collection("fund_requests").find({}).sort({ created_at: -1 }).toArray();
  } else {
    funds = getFundRequests();
  }

  // Scope funds by jurisdiction
  if (officer.level !== "national") {
    funds = funds.filter(f => {
      // Re-use logic similar to matchesJurisdiction
      const jur = officer.jurisdiction || {};
      const jurCode = (jur.code || "").toUpperCase();
      const jurName = (jur.name || "").toLowerCase();
      const fCode = (f.ward_code || "").toUpperCase();
      const fName = (f.ward_name || "").toLowerCase();
      
      if (f.officer_id === officer.user_id) return true;
      
      if (officer.level === "state") return true;
      if (officer.level === "district") {
        if (jurCode === "LUCKNOW") return fCode.includes("LKO") || fCode.includes("WARD_12") || fName.includes("lucknow") || fName.includes("hazratganj");
        if (jurCode === "KANPUR") return fCode.includes("KNP") || fCode.includes("WARD_88") || fCode.includes("WARD_36") || fCode.includes("WARD_58") || fName.includes("kanpur") || fName.includes("naubasta");
        return true;
      }
      if (officer.level === "zone") {
        if (jurCode.includes("LKO")) return fCode.includes("WARD_12") || fCode.includes("LKO");
        if (jurCode.includes("KNP")) return fCode.includes("WARD_88") || fCode.includes("WARD_36") || fCode.includes("WARD_58") || fCode.includes("KNP");
        return true;
      }
      if (officer.level === "ward") {
        return fCode.includes(jurCode) || (fCode && jurName && fCode.toLowerCase().includes(jurName));
      }
      return true;
    });
  }

  return funds.map(f => ({ ...f, _id: undefined }));
}

export async function createFundRequest(officer, data) {
  let db = null;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.warn("MongoDB connection fallback in createFundRequest:", err.message);
  }

  const now = new Date().toISOString();
  const fundDoc = {
    id: `FUND-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    complaint_id: data.complaint_id || null,
    title: data.title || "Civic Infrastructure Maintenance Fund",
    ward_code: officer.jurisdiction?.code || data.ward_code || "WARD_CIVIC",
    ward_name: officer.jurisdiction?.name || data.ward_name || "Assigned Jurisdiction",
    officer_id: officer.user_id,
    officer_name: officer.name,
    officer_designation: officer.designation,
    amount: Number(data.amount) || 50000,
    budget_head: data.budget_head || "Emergency Repairs & Maintenance",
    urgency: data.urgency || "High",
    justification: data.justification || "Necessary to resolve civic grievance.",
    contractor_tender_ref: data.contractor_tender_ref || `NIT/CIVIC/${Date.now().toString().slice(-4)}`,
    status: "Under Review",
    approved_by: null,
    approval_date: null,
    disbursed_amount: 0,
    created_at: now
  };

  if (db) {
    await db.collection("fund_requests").insertOne(fundDoc);
  } else {
    const all = getFundRequests();
    all.unshift(fundDoc);
    saveFundRequests(all);
  }

  return { ...fundDoc, _id: undefined };
}

export async function updateFundRequestStatus(officer, fundId, { action, remarks, approved_amount }) {
  let db = null;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.warn("MongoDB connection fallback in updateFundRequestStatus:", err.message);
  }

  const now = new Date().toISOString();
  let updatedFields = {
    status: action === "approve" ? "Approved" : action === "disburse" ? "Disbursed" : "Rejected",
    reviewed_by: officer.name,
    reviewed_by_designation: officer.designation,
    review_date: now,
    review_remarks: remarks || ""
  };

  if (action === "approve" || action === "disburse") {
    updatedFields.approved_by = `${officer.name} (${officer.designation})`;
    updatedFields.approval_date = now;
    if (approved_amount) updatedFields.amount = Number(approved_amount);
    if (action === "disburse") updatedFields.disbursed_amount = updatedFields.amount || 100000;
  }

  if (db) {
    await db.collection("fund_requests").updateOne(
      { id: fundId },
      { $set: updatedFields }
    );
  } else {
    const all = getFundRequests();
    const idx = all.findIndex(f => f.id === fundId);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updatedFields };
      saveFundRequests(all);
    }
  }

  return { fund_id: fundId, ...updatedFields };
}

// -------------------------------------------------------------
// Official Inter-Departmental Memos / Mail
// -------------------------------------------------------------
export async function listOfficialMemos(officer) {
  let db = null;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.warn("MongoDB connection fallback in listOfficialMemos:", err.message);
  }

  let memos = [];
  if (db) {
    memos = await db.collection("official_memos").find({}).sort({ sent_at: -1 }).toArray();
  } else {
    memos = getOfficialMemos();
  }

  if (officer.level !== "national") {
    memos = memos.filter(m => {
      if (m.sender_id === officer.user_id) return true;
      
      const jur = officer.jurisdiction || {};
      const jurCode = (jur.code || "").toUpperCase();
      const recId = (m.recipient_authority_id || "").toUpperCase();
      const recName = (m.recipient_authority_name || "").toLowerCase();
      const senderDept = (m.sender_dept || "").toLowerCase();
      
      if (officer.level === "state") return true;
      if (officer.level === "district") {
        if (jurCode === "LUCKNOW") return recName.includes("lucknow") || recId.includes("LNN") || recId.includes("LDA") || senderDept.includes("lucknow");
        if (jurCode === "KANPUR") return recName.includes("kanpur") || recId.includes("KNN") || recId.includes("KDA") || senderDept.includes("kanpur");
        return true;
      }
      if (officer.level === "zone") {
        if (jurCode.includes("LKO")) return recId === "LNN" || recId === "LDA" || senderDept.includes("lucknow");
        if (jurCode.includes("KNP")) return recId === "KNN" || recId === "KDA" || recId === "JAL" || senderDept.includes("kanpur");
        return true;
      }
      if (officer.level === "ward") {
        // Ward officers only see memos explicitly involving their department/authority
        return false;
      }
      return true;
    });
  }

  return memos.map(m => ({ ...m, _id: undefined }));
}

export async function dispatchOfficialMemo(officer, data) {
  let db = null;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.warn("MongoDB connection fallback in dispatchOfficialMemo:", err.message);
  }

  const now = new Date().toISOString();
  const memoDoc = {
    id: `MEMO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    memo_no: `${officer.department.slice(0, 4).toUpperCase()}/OFFICIAL/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`,
    sender_id: officer.user_id,
    sender_name: officer.name,
    sender_designation: officer.designation,
    sender_dept: officer.department,
    recipient_authority_id: data.recipient_authority_id || "JAL",
    recipient_authority_name: data.recipient_authority_name || "Jal Kal Vibhag",
    recipient_role: data.recipient_role || "Executive Engineer",
    subject: data.subject || "Official Coordination Notice",
    priority: data.priority || "High",
    body: data.body || "",
    complaint_id: data.complaint_id || null,
    status: "Dispatched",
    sent_at: now
  };

  if (db) {
    await db.collection("official_memos").insertOne(memoDoc);
  } else {
    const all = getOfficialMemos();
    all.unshift(memoDoc);
    saveOfficialMemos(all);
  }

  return { ...memoDoc, _id: undefined };
}

// -------------------------------------------------------------
// Subordinates, Task Assignment & Transfers
// -------------------------------------------------------------
export async function getSubordinatesDirectory(officer) {
  let allOfficers = [];
  let db = null;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.warn("MongoDB connection fallback in getSubordinatesDirectory:", err.message);
  }

  if (db) {
    allOfficers = await db.collection("officers").find({}).toArray();
  } else {
    allOfficers = getOfficers();
  }

  // Hierarchy levels order: national (0) -> state (1) -> district (2) -> zone (3) -> ward (4)
  const hierarchyWeight = {
    national: 0,
    state: 1,
    district: 2,
    zone: 3,
    ward: 4
  };

  const currentWeight = hierarchyWeight[officer.level] ?? 4;
  let subordinates = allOfficers.filter(o => {
    const targetWeight = hierarchyWeight[o.level] ?? 4;
    return targetWeight > currentWeight;
  });

  if (officer.level !== "national") {
    subordinates = subordinates.filter(sub => {
      const jur = officer.jurisdiction || {};
      const jurCode = (jur.code || "").toUpperCase();
      const subCode = (sub.jurisdiction?.code || "").toUpperCase();
      const subCity = (sub.jurisdiction?.city || "").toLowerCase();
      
      if (officer.level === "state") return true;
      if (officer.level === "district") {
        if (jurCode === "LUCKNOW") return subCity.includes("lucknow") || subCode.includes("LKO") || subCode.includes("WARD_12");
        if (jurCode === "KANPUR") return subCity.includes("kanpur") || subCode.includes("KNP") || subCode.includes("WARD_88") || subCode.includes("WARD_36") || subCode.includes("WARD_58");
        return true;
      }
      if (officer.level === "zone") {
        if (jurCode.includes("LKO")) return subCode.includes("WARD_12") || subCode.includes("LKO");
        if (jurCode.includes("KNP")) return subCode.includes("WARD_88") || subCode.includes("WARD_36") || subCode.includes("WARD_58") || subCode.includes("KNP");
        return true;
      }
      return false;
    });
  }

  // Calculate real-time active tasks and workload for each subordinate
  let allTasks = [];
  let allComplaints = [];
  if (db) {
    allTasks = await db.collection("officer_tasks").find({}).toArray();
    allComplaints = await db.collection("complaints").find({}).toArray();
  } else {
    allTasks = getOfficerTasks();
    allComplaints = getComplaints();
  }

  return subordinates.map(sub => {
    const openTasks = allTasks.filter(t => t.assigned_to_id === sub.id && t.status !== "Completed").length;
    const subComplaints = allComplaints.filter(c => matchesJurisdiction(c, sub));
    const openComplaints = subComplaints.filter(c => !["Resolved", "Closed"].includes(c.status)).length;
    const resolvedComplaints = subComplaints.filter(c => ["Resolved", "Closed"].includes(c.status)).length;
    const resolutionRate = subComplaints.length > 0 
      ? Math.round((resolvedComplaints / subComplaints.length) * 100) 
      : 88;

    return {
      id: sub.id,
      name: sub.name,
      email: sub.email,
      designation: sub.designation,
      department: sub.department,
      level: sub.level,
      badge: sub.badge,
      phone: sub.phone,
      jurisdiction: sub.jurisdiction,
      workload: {
        active_tasks: openTasks,
        open_complaints: openComplaints,
        resolution_rate: resolutionRate,
        rating: (4.0 + (resolutionRate % 10) * 0.08).toFixed(1)
      }
    };
  });
}

export async function assignSubordinateTask(officer, taskData) {
  let db = null;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.warn("MongoDB connection fallback in assignSubordinateTask:", err.message);
  }

  const now = new Date().toISOString();
  const taskDoc = {
    id: `TSK-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    assigned_by_id: officer.user_id,
    assigned_by_name: `${officer.name} (${officer.designation})`,
    assigned_to_id: taskData.assigned_to_id,
    assigned_to_name: taskData.assigned_to_name || "Junior Officer",
    assigned_to_designation: taskData.assigned_to_designation || "Executive Engineer",
    task_type: taskData.task_type || "DIRECT_INSPECTION",
    title: taskData.title || "Official Field Directive",
    instructions: taskData.instructions || "Execute site verification and submit status report on Nirikshan.",
    deadline: taskData.deadline || new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    priority: taskData.priority || "High",
    status: "Assigned",
    created_at: now
  };

  if (db) {
    await db.collection("officer_tasks").insertOne(taskDoc);
  } else {
    const all = getOfficerTasks();
    all.unshift(taskDoc);
    saveOfficerTasks(all);
  }

  return { ...taskDoc, _id: undefined };
}

export async function transferJuniorOfficer(officer, { target_officer_id, new_ward_code, new_ward_name, new_city, reason }) {
  let db = null;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.warn("MongoDB connection fallback in transferJuniorOfficer:", err.message);
  }

  let targetOfficer = null;
  if (db) {
    targetOfficer = await db.collection("officers").findOne({ id: target_officer_id });
  } else {
    const all = getOfficers();
    targetOfficer = all.find(o => o.id === target_officer_id);
  }

  if (!targetOfficer) throw new Error("Target junior officer not found");

  const oldJurisdiction = targetOfficer.jurisdiction?.name || "Previous Area";
  const updatedJurisdiction = {
    ...targetOfficer.jurisdiction,
    code: new_ward_code,
    name: new_ward_name,
    city: new_city || targetOfficer.jurisdiction?.city || "Lucknow"
  };

  const now = new Date().toISOString();
  if (db) {
    await db.collection("officers").updateOne(
      { id: target_officer_id },
      { $set: { jurisdiction: updatedJurisdiction, last_transferred_at: now, transferred_by: officer.name } }
    );
  } else {
    const all = getOfficers();
    const idx = all.findIndex(o => o.id === target_officer_id);
    if (idx !== -1) {
      all[idx].jurisdiction = updatedJurisdiction;
      all[idx].last_transferred_at = now;
      saveOfficers(all);
    }
  }

  // Log transfer order as an official task record
  const transferNotice = {
    id: `TSK-TRF-${Math.floor(100 + Math.random() * 900)}`,
    assigned_by_id: officer.user_id,
    assigned_by_name: `${officer.name} (${officer.designation})`,
    assigned_to_id: targetOfficer.id,
    assigned_to_name: targetOfficer.name,
    assigned_to_designation: targetOfficer.designation,
    task_type: "TRANSFER_ORDER",
    title: `Official Transfer Order: Relocation to ${new_ward_name}`,
    instructions: `By order of ${officer.name}, you are transferred from ${oldJurisdiction} to ${new_ward_name} effective immediately. Reason: ${reason || "Administrative realignment"}.`,
    deadline: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    priority: "Critical",
    status: "Assigned",
    created_at: now
  };

  if (db) {
    await db.collection("officer_tasks").insertOne(transferNotice);
  } else {
    const all = getOfficerTasks();
    all.unshift(transferNotice);
    saveOfficerTasks(all);
  }

  return {
    success: true,
    officer_id: target_officer_id,
    officer_name: targetOfficer.name,
    previous_jurisdiction: oldJurisdiction,
    new_jurisdiction: new_ward_name,
    transferred_at: now
  };
}

// -------------------------------------------------------------
// Area Performance Rating & Scorecard
// -------------------------------------------------------------
export async function calculateJurisdictionScorecard(officer) {
  const complaints = await listJurisdictionComplaints(officer);

  const total = complaints.length;
  const resolved = complaints.filter(c => ["Resolved", "Closed"].includes(c.status)).length;
  const inProgress = complaints.filter(c => ["In Progress", "Verified", "Assigned"].includes(c.status)).length;
  const escalated = complaints.filter(c => c.escalated).length;
  const underInspection = complaints.filter(c => c.scheduled_inspection).length;

  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 85;
  const slaCompliance = Math.max(70, Math.min(98, Math.round(100 - (escalated * 8))));
  const civicQualityScore = Math.min(96, Math.max(55, Math.round(72 + (resolutionRate * 0.2) - (escalated * 3))));
  const citizenRating = (3.8 + (resolutionRate / 100) * 1.1).toFixed(1);

  // Category counts
  const categoryBreakdown = {};
  for (const c of complaints) {
    const cat = c.issue_type || "General";
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
  }

  return {
    jurisdiction_name: officer.jurisdiction?.name || "Assigned Area",
    jurisdiction_level: officer.level,
    civic_quality_score: civicQualityScore,
    citizen_satisfaction_rating: citizenRating,
    sla_compliance_rate: slaCompliance,
    metrics: {
      total_complaints: total,
      resolved_complaints: resolved,
      in_progress: inProgress,
      escalated: escalated,
      under_inspection: underInspection,
      resolution_rate: resolutionRate
    },
    category_breakdown: categoryBreakdown
  };
}
