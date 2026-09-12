"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";

const ISSUE_ICONS = {
  Pothole: "🕳️",
  Water: "🚰",
  Streetlight: "💡",
  Sewer: "🚿",
  Garbage: "🗑️",
  Safety: "⚠️",
  Encroachment: "🚧"
};

const HIERARCHY_PRESETS = [
  { label: "🏛️ National Director (MoHUA)", email: "national.director@nirikshan.gov.in" },
  { label: "🏢 State Secretary (UP)", email: "secretary.up@nirikshan.gov.in" },
  { label: "⚖️ DM Lucknow", email: "dm.lucknow@nirikshan.gov.in" },
  { label: "📐 Municipal Comm. Kanpur", email: "commissioner.kanpur@nirikshan.gov.in" },
  { label: "⚡ Zonal Officer (Zone 3)", email: "zonal.officer.zone3@nirikshan.gov.in" },
  { label: "📍 Ward 88 Engineer (Kanpur)", email: "ward88.engineer@nirikshan.gov.in" },
  { label: "📍 Ward 12 Engineer (Lucknow)", email: "ward12.engineer@nirikshan.gov.in" }
];

const AUTHORITIES_LIST = [
  { id: "KNN", name: "Kanpur Nagar Nigam", role: "Municipal Commissioner" },
  { id: "LNN", name: "Lucknow Nagar Nigam", role: "Municipal Commissioner" },
  { id: "KDA", name: "Kanpur Development Authority", role: "Vice Chairman" },
  { id: "LDA", name: "Lucknow Development Authority", role: "Vice Chairman" },
  { id: "JAL", name: "Jal Kal Vibhag", role: "General Manager (Water & Drainage)" },
  { id: "PWD", name: "Public Works Department", role: "Chief Engineer (Roads)" },
  { id: "DISCOM", name: "Madhyanchal Vidyut Vitran", role: "Chief Engineer (Electrical)" },
  { id: "POLICE", name: "Traffic & Civic Police Wing", role: "DCP Traffic" }
];

export default function OfficerDashboardView() {
  const router = useRouter();
  const [officer, setOfficer] = useState(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);

  // Active navigation section: "map", "complaints", "funds", "memos", "subordinates", "scorecard"
  const [activeSection, setActiveSection] = useState("map");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Data states
  const [complaints, setComplaints] = useState([]);
  const [funds, setFunds] = useState([]);
  const [memos, setMemos] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [scorecard, setScorecard] = useState(null);

  // Filter states
  const [complaintFilter, setComplaintFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  // Map state & ref
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const boundaryLayerRef = useRef(null);
  const referenceLayerRef = useRef(null);
  const aqiLayerRef = useRef(null);
  const currentAqiLevelRef = useRef(null);
  const fetchedAreasCache = useRef({});
  const zoomDebounceRef = useRef(null);
  const [hoveredArea, setHoveredArea] = useState(null);
  const [mapTheme, setMapTheme] = useState("dark");

  // Modals state
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState("status_change");
  const [actionStatus, setActionStatus] = useState("In Progress");
  const [actionNotes, setActionNotes] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardTargetLevel, setForwardTargetLevel] = useState("district");
  const [forwardTargetAuthority, setForwardTargetAuthority] = useState("District Command");
  const [forwardJustification, setForwardJustification] = useState("");
  const [forwardUrgency, setForwardUrgency] = useState("High");

  const [showFundModal, setShowFundModal] = useState(false);
  const [fundTitle, setFundTitle] = useState("");
  const [fundAmount, setFundAmount] = useState(150000);
  const [fundBudgetHead, setFundBudgetHead] = useState("Emergency Road & Drainage Restoration");
  const [fundUrgency, setFundUrgency] = useState("High");
  const [fundJustification, setFundJustification] = useState("");
  const [fundTenderRef, setFundTenderRef] = useState("");
  const [fundComplaintId, setFundComplaintId] = useState("");

  const [showMemoModal, setShowMemoModal] = useState(false);
  const [memoRecipientId, setMemoRecipientId] = useState("JAL");
  const [memoSubject, setMemoSubject] = useState("");
  const [memoPriority, setMemoPriority] = useState("Urgent");
  const [memoBody, setMemoBody] = useState("");

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTargetSubordinate, setTaskTargetSubordinate] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskInstructions, setTaskInstructions] = useState("");
  const [taskPriority, setTaskPriority] = useState("High");

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferOfficerId, setTransferOfficerId] = useState("");
  const [transferWardCode, setTransferWardCode] = useState("WARD_45_KANPUR");
  const [transferWardName, setTransferWardName] = useState("Ward 45 (Govind Nagar)");
  const [transferReason, setTransferReason] = useState("Operational realignment");

  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // 1. Check Officer Authentication Session & Handle Responsive Sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1200) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 2. Fetch Data from Endpoints
  const fetchInitialData = useCallback(async (activeToken) => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${activeToken}` };

      const [complaintsRes, fundsRes, memosRes, subordinatesRes, statsRes] = await Promise.all([
        fetch("/api/officer/complaints", { headers }),
        fetch("/api/officer/funds", { headers }),
        fetch("/api/officer/mail", { headers }),
        fetch("/api/officer/subordinates", { headers }),
        fetch("/api/officer/stats", { headers })
      ]);

      if (complaintsRes.ok) {
        const cData = await complaintsRes.json();
        setComplaints(cData.complaints || []);
      }
      if (fundsRes.ok) {
        const fData = await fundsRes.json();
        setFunds(fData.funds || []);
      }
      if (memosRes.ok) {
        const mData = await memosRes.json();
        setMemos(mData.memos || []);
      }
      if (subordinatesRes.ok) {
        const sData = await subordinatesRes.json();
        setSubordinates(sData.subordinates || []);
      }
      if (statsRes.ok) {
        const stData = await statsRes.json();
        setScorecard(stData);
      }
    } catch (err) {
      console.error("Failed to load officer data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("nirikshan_officer_token");
    const savedProfile = localStorage.getItem("nirikshan_officer_profile");

    if (!savedToken || !savedProfile) {
      router.replace("/officer/login");
      return;
    }

    try {
      const parsed = JSON.parse(savedProfile);
      queueMicrotask(() => {
        setOfficer(parsed);
        setToken(savedToken);
        fetchInitialData(savedToken);
      });
    } catch {
      router.replace("/officer/login");
    }
  }, [router, fetchInitialData]);

  // Fast switch accounts for testing
  const handleQuickSwitch = async (email) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "admin123", role: "officer" })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("nirikshan_officer_token", data.token);
        localStorage.setItem("nirikshan_officer_profile", JSON.stringify(data.officer));
        setOfficer(data.officer);
        setToken(data.token);
        showNotification(`Switched identity to ${data.officer.name} (${data.officer.badge})`, "info");
        await fetchInitialData(data.token);
        // Re-focus map to new officer jurisdiction
        if (mapInstanceRef.current && data.officer.jurisdiction) {
          const { lat, lng, zoom } = data.officer.jurisdiction;
          mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1.2 });
        }
      }
    } catch (err) {
      showNotification("Failed to switch officer account", "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("nirikshan_officer_token");
    localStorage.removeItem("nirikshan_officer_profile");
    router.push("/officer/login");
  };

  // 3. Initialize Map with Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || !officer) return;

    if (!mapInstanceRef.current) {
      const centerLat = officer.jurisdiction?.lat || 26.8467;
      const centerLng = officer.jurisdiction?.lng || 80.9462;
      const initialZoom = officer.jurisdiction?.zoom || 13;

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: initialZoom,
        zoomControl: false
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Base tile layer
      const getTileUrl = (theme) => {
        if (theme === "street") return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
        if (theme === "satellite") return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
        return "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
      };

      const tileLayer = L.tileLayer(getTileUrl(mapTheme), {
        attribution: "&copy; Nirikshan Spatial Gov",
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
      mapInstanceRef.current.tileLayer = tileLayer;
      
      // Initialize reference layer for labels
      const refLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
        pane: 'markerPane'
      });
      referenceLayerRef.current = refLayer;
      if (mapTheme === "dark") {
        refLayer.addTo(map);
      }

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
    } else {
      // Re-center if officer changes
      const { lat, lng, zoom } = officer.jurisdiction || { lat: 26.8467, lng: 80.9462, zoom: 13 };
      mapInstanceRef.current.setView([lat, lng], zoom);
    }
  }, [officer, mapTheme]);

  // Update map tiles on theme change
  useEffect(() => {
    if (!mapInstanceRef.current || !mapInstanceRef.current.tileLayer) return;
    const urls = {
      street: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      dark: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
    };
    mapInstanceRef.current.tileLayer.setUrl(urls[mapTheme] || urls.dark);
    
    if (mapTheme === "dark" && referenceLayerRef.current && !mapInstanceRef.current.hasLayer(referenceLayerRef.current)) {
      referenceLayerRef.current.addTo(mapInstanceRef.current);
    } else if (mapTheme !== "dark" && referenceLayerRef.current && mapInstanceRef.current.hasLayer(referenceLayerRef.current)) {
      mapInstanceRef.current.removeLayer(referenceLayerRef.current);
    }
  }, [mapTheme]);

  // Render complaint markers on map
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;
    markersGroupRef.current.clearLayers();

    complaints.forEach((c) => {
      const lat = Number(c.latitude);
      const lng = Number(c.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const iconEmoji = ISSUE_ICONS[c.issue_type] || "📍";
      const isResolved = ["Resolved", "Closed"].includes(c.status);
      const isEscalated = c.escalated;

      const markerHtml = `
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full border shadow-lg transition-transform hover:scale-110 ${
          isResolved 
            ? "bg-emerald-950/90 border-emerald-400 text-emerald-300"
            : isEscalated
            ? "bg-rose-950/90 border-rose-500 text-rose-300 animate-pulse ring-2 ring-rose-500/50"
            : "bg-slate-900/90 border-amber-400 text-amber-300"
        }">
          <span class="text-sm">${iconEmoji}</span>
          ${isEscalated ? `<span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full"></span>` : ""}
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "custom-officer-marker",
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const hasImage = !!c.image_url;
      const popupHtml = `
        <div style="font-family: inherit; min-width: 240px; color: #f8fafc; padding: 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <strong style="color: #38bdf8; font-size: 14px; display: flex; align-items: center; gap: 4px;">${iconEmoji} ${c.issue_type}</strong>
            <span style="font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; background: ${isResolved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}; color: ${isResolved ? '#34d399' : '#fb7185'}; border: 1px solid ${isResolved ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 113, 133, 0.3)'};">${c.status}</span>
          </div>
          
          <p style="font-size: 13px; margin: 0 0 4px 0; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${c.street ? c.street + ', ' : ''}${c.place_name || "Civic Spot"}</p>
          <p style="font-size: 11px; color: #cbd5e1; margin: 0 0 12px 0; line-height: 1.4;">${c.description}</p>
          
          ${hasImage ? `
            <div style="margin-bottom: 12px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
              <img src="${c.image_url}" alt="Complaint image" style="width: 100%; height: 130px; object-fit: cover; display: block;" />
            </div>
          ` : ''}
          
          <div style="display: flex; gap: 8px; font-size: 10px; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
            <span style="background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 4px;">Trust: <strong style="color: #e2e8f0;">${c.user_trust_score || 80}</strong></span>
            <span style="background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 4px;">Open: <strong style="color: #e2e8f0;">${c.days_open || 1}d</strong></span>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'glass-popup'
      });
      marker.on("click", () => {
        setSelectedComplaint(c);
      });

      markersGroupRef.current.addLayer(marker);
    });
  }, [complaints]);

  // Load official boundary geojson based on officer jurisdiction
  useEffect(() => {
    if (!mapInstanceRef.current || !officer?.jurisdiction) return;

    const jur = officer.jurisdiction;
    const geoFile = jur.geojson_file;
    if (!geoFile) return;

    if (boundaryLayerRef.current) {
      mapInstanceRef.current.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }

    fetch(`/${geoFile}`)
      .then((res) => {
        if (!res.ok) throw new Error("GeoJSON not found in public");
        return res.json();
      })
      .then((data) => {
        if (!mapInstanceRef.current) return;
        const layer = L.geoJSON(data, {
          filter: (feat) => {
            if (!jur.feature_name) return true;
            const props = feat.properties || {};
            const name = props.name || props.district || props.ward_name || props.ST_NM || props.NAME_1 || "";
            return name.toLowerCase().includes(jur.feature_name.toLowerCase());
          },
          style: {
            color: "#f59e0b",
            weight: 2.5,
            dashArray: "4, 6",
            fillColor: "#f59e0b",
            fillOpacity: 0.08
          }
        });

        layer.addTo(mapInstanceRef.current);
        boundaryLayerRef.current = layer;

        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: jur.zoom || 14 });
        }
      })
      .catch((err) => {
        console.warn("Boundary layer optional load error:", err.message);
      });
  }, [officer]);

  // Action handlers
  const handleAdvanceStatus = async () => {
    if (!selectedComplaint) return;
    try {
      const res = await fetch(`/api/officer/complaints/${selectedComplaint.complaint_id}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action_type: actionType,
          status: actionStatus,
          notes: actionNotes,
          inspection_date: inspectionDate,
          rejection_reason: rejectionReason
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Action failed");

      showNotification(`Grievance ${selectedComplaint.complaint_id} updated: ${actionStatus}`);
      setShowActionModal(false);
      setSelectedComplaint(null);
      await fetchInitialData(token);
    } catch (err) {
      showNotification(err.message, "error");
    }
  };

  const handleForwardUpper = async () => {
    if (!selectedComplaint) return;
    try {
      const res = await fetch(`/api/officer/complaints/${selectedComplaint.complaint_id}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action_type: "forward_upper",
          target_level: forwardTargetLevel,
          target_authority: forwardTargetAuthority,
          justification: forwardJustification,
          urgency: forwardUrgency
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Escalation failed");

      showNotification(`Grievance forwarded to ${forwardTargetLevel.toUpperCase()} command`);
      setShowForwardModal(false);
      setSelectedComplaint(null);
      await fetchInitialData(token);
    } catch (err) {
      showNotification(err.message, "error");
    }
  };

  const handleCreateFund = async () => {
    if (!fundTitle || !fundAmount) {
      showNotification("Title and amount are required", "error");
      return;
    }

    try {
      const res = await fetch("/api/officer/funds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: fundTitle,
          amount: fundAmount,
          budget_head: fundBudgetHead,
          urgency: fundUrgency,
          justification: fundJustification,
          contractor_tender_ref: fundTenderRef,
          complaint_id: fundComplaintId || selectedComplaint?.complaint_id || null
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to raise fund requisition");

      showNotification(`Fund Requisition of ₹${Number(fundAmount).toLocaleString('en-IN')} submitted!`);
      setShowFundModal(false);
      setFundTitle("");
      setFundJustification("");
      await fetchInitialData(token);
    } catch (err) {
      showNotification(err.message, "error");
    }
  };

  const handleReviewFund = async (fundId, action) => {
    try {
      const res = await fetch("/api/officer/funds", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fund_id: fundId,
          action,
          remarks: `Approved by ${officer?.name} (${officer?.badge})`
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Fund action failed");

      showNotification(`Fund Requisition ${fundId} marked as ${action.toUpperCase()}`);
      await fetchInitialData(token);
    } catch (err) {
      showNotification(err.message, "error");
    }
  };

  const handleSendMemo = async () => {
    if (!memoSubject || !memoBody) {
      showNotification("Subject and memo body are required", "error");
      return;
    }

    const recipient = AUTHORITIES_LIST.find((a) => a.id === memoRecipientId) || AUTHORITIES_LIST[0];

    try {
      const res = await fetch("/api/officer/mail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recipient_authority_id: recipient.id,
          recipient_authority_name: recipient.name,
          recipient_role: recipient.role,
          subject: memoSubject,
          priority: memoPriority,
          body: memoBody,
          complaint_id: selectedComplaint?.complaint_id || null
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to dispatch memo");

      showNotification(`Official Memo dispatched to ${recipient.name}!`);
      setShowMemoModal(false);
      setMemoSubject("");
      setMemoBody("");
      await fetchInitialData(token);
    } catch (err) {
      showNotification(err.message, "error");
    }
  };

  const handleAssignTask = async () => {
    if (!taskTargetSubordinate || !taskTitle) {
      showNotification("Subordinate and task title are required", "error");
      return;
    }

    const sub = subordinates.find((s) => s.id === taskTargetSubordinate);

    try {
      const res = await fetch("/api/officer/subordinates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          assigned_to_id: taskTargetSubordinate,
          assigned_to_name: sub?.name || "Junior Officer",
          assigned_to_designation: sub?.designation || "Engineer",
          title: taskTitle,
          instructions: taskInstructions,
          priority: taskPriority
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to assign directive");

      showNotification(`Official Directive assigned to ${sub?.name}!`);
      setShowTaskModal(false);
      setTaskTitle("");
      setTaskInstructions("");
      await fetchInitialData(token);
    } catch (err) {
      showNotification(err.message, "error");
    }
  };

  const handleTransferOfficer = async () => {
    if (!transferOfficerId) return;

    try {
      const res = await fetch("/api/officer/subordinates", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          target_officer_id: transferOfficerId,
          new_ward_code: transferWardCode,
          new_ward_name: transferWardName,
          reason: transferReason
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Transfer failed");

      showNotification(`Transfer order issued: ${data.officer_name} → ${data.new_jurisdiction}`);
      setShowTransferModal(false);
      await fetchInitialData(token);
    } catch (err) {
      showNotification(err.message, "error");
    }
  };

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    if (complaintFilter === "active" && ["Resolved", "Closed", "Rejected"].includes(c.status)) return false;
    if (complaintFilter === "escalated" && !c.escalated) return false;
    if (complaintFilter === "inspection" && !c.scheduled_inspection) return false;
    if (complaintFilter === "resolved" && !["Resolved", "Closed"].includes(c.status)) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchText = `${c.place_name || ""} ${c.description || ""} ${c.issue_type || ""} ${c.complaint_id || ""}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }

    return true;
  });

  const scoreToColor = (score) => {
    if (score >= 90) return "#10b981"; // Emerald
    if (score >= 70) return "#84cc16"; // Lime
    if (score >= 50) return "#eab308"; // Yellow
    if (score >= 30) return "#f97316"; // Orange
    return "#ef4444"; // Red
  };

  const refreshAqiLayer = useCallback(async (level = null, force = false) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!level) {
      const z = map.getZoom();
      if (z < 6) level = "india-states";
      else if (z < 9) level = "up-districts";
      else if (z < 12) level = "kanpur-subdistricts";
      else if (z < 14) level = "macro";
      else if (z < 16) level = "micro";
      else level = "submicro";
    }

    if (!force && currentAqiLevelRef.current === level && aqiLayerRef.current && map.hasLayer(aqiLayerRef.current)) {
      return;
    }
    currentAqiLevelRef.current = level;

    let data;
    if (!force && fetchedAreasCache.current[level]) {
      data = await fetchedAreasCache.current[level];
    } else {
      const fetchPromise = fetch(`/api/areas?level=${level}`).then(r => r.json());
      fetchedAreasCache.current[level] = fetchPromise;
      data = await fetchPromise;
      fetchedAreasCache.current[level] = data;
    }

    const oldLayer = aqiLayerRef.current;
    if (oldLayer && map.hasLayer(oldLayer)) {
      map.removeLayer(oldLayer);
    }

    const layer = L.geoJSON(data, {
      style: (feature) => {
        return {
          fillColor: scoreToColor(feature.properties.area_score),
          color: "#ffffff",
          weight: 1.5,
          fillOpacity: 0.45,
          className: "aqi-region"
        };
      },
      onEachFeature: (feature, childLayer) => {
        const areaName = feature.properties.name || "Administrative Area";
        childLayer.bindTooltip(`
          <div class="area-tooltip-content" style="font-family: inherit; font-size: 12px; font-weight: 500; color: #f8fafc;">
            <div style="font-weight: bold; margin-bottom: 2px;">${areaName}</div>
            <div style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background:${scoreToColor(feature.properties.area_score)}44; color:${scoreToColor(feature.properties.area_score)}; border: 1px solid ${scoreToColor(feature.properties.area_score)}; display: inline-block;">
              AQI Score: ${feature.properties.area_score}
            </div>
          </div>
        `, { sticky: true });

        childLayer.on("mouseover", (e) => {
          setHoveredArea({
            name: areaName,
            level: level,
            score: feature.properties.area_score,
            status: feature.properties.area_status || "Standard",
            authority: feature.properties.authority,
            city: feature.properties.city
          });
          if (typeof childLayer.setStyle === "function") {
            childLayer.setStyle({ color: "#c084fc", weight: 2.5 });
          }
        });

        childLayer.on("mouseout", (e) => {
          setHoveredArea(null);
          if (typeof childLayer.setStyle === "function") {
            childLayer.setStyle({ color: "#ffffff", weight: 1.5 });
          }
        });
      }
    });

    aqiLayerRef.current = layer;
    if (activeSection === "aqi") {
      layer.addTo(map);
    }
  }, [activeSection]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleZoomEnd = () => {
      if (activeSection !== "aqi") return;
      if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
      zoomDebounceRef.current = setTimeout(async () => {
        await refreshAqiLayer();
      }, 150);
    };

    map.on('zoomend', handleZoomEnd);
    return () => map.off('zoomend', handleZoomEnd);
  }, [activeSection, refreshAqiLayer]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (activeSection === "aqi") {
      refreshAqiLayer(null, true);
      if (markersGroupRef.current) map.removeLayer(markersGroupRef.current);
    } else {
      if (aqiLayerRef.current && map.hasLayer(aqiLayerRef.current)) {
        map.removeLayer(aqiLayerRef.current);
      }
      if (activeSection === "map") {
        if (markersGroupRef.current && !map.hasLayer(markersGroupRef.current)) {
          markersGroupRef.current.addTo(map);
        }
      }
    }
  }, [activeSection, refreshAqiLayer]);

  if (!officer) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium tracking-wide text-amber-400">Loading Nirikshan Command Console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 ${
          notification.type === "error" 
            ? "bg-rose-950/90 border-rose-500/50 text-rose-200" 
            : notification.type === "info"
            ? "bg-cyan-950/90 border-cyan-500/50 text-cyan-200"
            : "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
        }`}>
          <span>{notification.type === "error" ? "⚠️" : notification.type === "info" ? "ℹ️" : "✓"}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between z-30 shrink-0 gap-3">
        {/* Brand & Department */}
        <div className="flex items-center gap-3 shrink-0 min-w-0">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Toggle Navigation Menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-amber-500/20 border border-amber-400/30 shrink-0">
              🏛️
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">Nirikshan Command Console</h1>
                <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold uppercase shrink-0">
                  {officer.level}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 leading-none truncate max-w-xs md:max-w-md mt-0.5">
                {officer.department}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Jurisdiction Badge (Visible on wider screens) */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-xl shrink-0">
          <span className="text-amber-400 text-xs font-medium">📍 Jurisdiction:</span>
          <span className="text-xs font-bold text-slate-100 truncate max-w-[200px]">{officer.jurisdiction?.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono uppercase">
            {officer.jurisdiction?.type}
          </span>
        </div>

        {/* Right: Quick Switcher, Officer Profile & Logout */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Switcher dropdown for instant testing across hierarchy */}
          <div className="relative shrink-0">
            <select
              value={officer.email}
              onChange={(e) => handleQuickSwitch(e.target.value)}
              className="bg-slate-950 border border-amber-500/40 hover:border-amber-400 text-amber-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer font-medium max-w-[150px] sm:max-w-[200px] truncate"
              title="Quickly test any administrative tier"
            >
              {HIERARCHY_PRESETS.map((p, i) => (
                <option key={i} value={p.email} className="bg-slate-900 text-slate-200">
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Officer Avatar / Profile summary */}
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-800 shrink-0">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
              {officer.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
            </div>
            <div className="text-left leading-none max-w-[120px] sm:max-w-[150px]">
              <p className="text-xs font-semibold text-slate-100 truncate">{officer.name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{officer.badge}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="shrink-0 text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Sign Out"
          >
            <span>Exit</span>
            <span>⎋</span>
          </button>
        </div>
      </header>

      {/* Main Workspace (Sidebar + Dynamic View Area) */}
      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
        {/* Collapsible Sidebar */}
        <aside
          className={`${
            sidebarCollapsed ? "w-16" : "w-56 xl:w-64"
          } transition-all duration-300 border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex flex-col justify-between shrink-0 z-20`}
        >
          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5">
            {[
              { id: "map", label: "Command Map", icon: "🗺️", count: null },
              { id: "aqi", label: "AQI Area Score", icon: "🍃", count: null },
              { id: "complaints", label: "Area Complaints", icon: "📋", count: complaints.length },
              { id: "funds", label: "Fund Requisitions", icon: "💰", count: funds.length },
              { id: "memos", label: "Official Mail & Memos", icon: "✉️", count: memos.length },
              { id: "subordinates", label: "Junior Officers", icon: "👥", count: subordinates.length },
              { id: "scorecard", label: "Area Scorecard", icon: "📊", count: null }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                title={item.label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group cursor-pointer ${
                  activeSection === item.id
                    ? "bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/40 text-amber-300 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                {!sidebarCollapsed && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}
                {!sidebarCollapsed && item.count !== null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      activeSection === item.id
                        ? "bg-amber-500/30 text-amber-200 font-bold"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Sidebar Footer Area Card */}
          {!sidebarCollapsed && scorecard && (
            <div className="p-3.5 m-3 bg-slate-950/80 border border-slate-800 rounded-xl">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-400">Civic Quality Index</span>
                <span className="font-bold text-amber-400 font-mono">
                  {scorecard.civic_quality_score}/100
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full"
                  style={{ width: `${scorecard.civic_quality_score}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>⭐ {scorecard.citizen_satisfaction_rating} Rating</span>
                <span>⚡ {scorecard.sla_compliance_rate}% SLA</span>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Pane with min-w-0 for flex containment */}
        <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden bg-slate-950">
          {/* ========================================================================= */}
          {/* VIEW 1: COMMAND MAP */}
          {/* ========================================================================= */}
          <div className={`h-full w-full relative ${activeSection === "map" || activeSection === "aqi" ? "flex" : "hidden"}`}>
            {/* Map Container */}
            <div ref={mapContainerRef} className="h-full w-full z-0"></div>

            {/* Map Floating HUD: Mode & Area Controls */}
            <div className="absolute top-4 left-4 z-10 bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-xl p-3 shadow-2xl flex flex-col gap-2.5 max-w-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <span>🗺️</span>
                  <span>{officer.jurisdiction?.name}</span>
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                  {officer.level}
                </span>
              </div>

              {/* Theme selector */}
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setMapTheme("dark")}
                  className={`flex-1 py-1 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    mapTheme === "dark" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setMapTheme("street")}
                  className={`flex-1 py-1 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    mapTheme === "street" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  Street
                </button>
                <button
                  onClick={() => setMapTheme("satellite")}
                  className={`flex-1 py-1 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    mapTheme === "satellite" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  Satellite
                </button>
              </div>

              {/* Quick statistics badge */}
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                <span>Active Grievances:</span>
                <span className="font-bold text-slate-200 font-mono">{complaints.length}</span>
              </div>
            </div>

            {/* Hovered Area HUD for AQI Mode */}
            {activeSection === "aqi" && hoveredArea && (
              <div className="absolute top-4 right-4 z-10 w-64 bg-slate-900/95 border border-slate-800 backdrop-blur-xl rounded-xl p-3 shadow-2xl animate-in slide-in-from-right duration-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{hoveredArea.level} LEVEL</div>
                <div className="font-bold text-white text-sm mb-2">{hoveredArea.name}</div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-2xl font-bold font-mono" style={{ color: scoreToColor(hoveredArea.score) }}>
                    {hoveredArea.score}
                  </div>
                  <div className="text-xs px-2 py-1 rounded bg-slate-800 border" style={{ borderColor: scoreToColor(hoveredArea.score), color: scoreToColor(hoveredArea.score) }}>
                    {hoveredArea.status}
                  </div>
                </div>
                {hoveredArea.authority && (
                  <div className="text-[10px] text-slate-400">Auth: <span className="text-slate-300">{hoveredArea.authority}</span></div>
                )}
              </div>
            )}

            {/* Quick Action Drawer when complaint is selected on map */}
            {selectedComplaint && (
              <div className="absolute top-4 right-4 z-10 w-96 max-w-[calc(100vw-2rem)] bg-slate-900/95 border border-slate-800 backdrop-blur-xl rounded-2xl p-5 shadow-2xl animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{ISSUE_ICONS[selectedComplaint.issue_type] || "📍"}</span>
                    <div>
                      <h4 className="text-sm font-bold text-white leading-tight">
                        {selectedComplaint.issue_type}
                      </h4>
                      <p className="text-[11px] text-cyan-400">{selectedComplaint.place_name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedComplaint(null)}
                    className="text-slate-400 hover:text-white text-sm p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="py-3 space-y-2 text-xs">
                  <p className="text-slate-300 leading-relaxed">{selectedComplaint.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">CURRENT STATUS</span>
                      <span className="font-semibold text-amber-300">{selectedComplaint.status}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">TRUST SCORE</span>
                      <span className="font-semibold text-emerald-400">{selectedComplaint.user_trust_score || 80} / 100</span>
                    </div>
                  </div>

                  {selectedComplaint.escalated && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1.5">
                      <span>⚠️</span>
                      <span>Escalated Grievance (Priority Resolution Required)</span>
                    </div>
                  )}

                  {selectedComplaint.linked_funds?.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px]">
                      💰 Linked Budget: ₹{selectedComplaint.linked_funds[0].amount?.toLocaleString("en-IN")} ({selectedComplaint.linked_funds[0].status})
                    </div>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setActionType("status_change");
                        setActionStatus(selectedComplaint.status === "In Progress" ? "Resolved" : "In Progress");
                        setShowActionModal(true);
                      }}
                      className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer"
                    >
                      Update Status
                    </button>
                    <button
                      onClick={() => setShowForwardModal(true)}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Forward ↗
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setFundComplaintId(selectedComplaint.complaint_id);
                      setFundTitle(`Emergency Restoration for ${selectedComplaint.issue_type} at ${selectedComplaint.place_name}`);
                      setShowFundModal(true);
                    }}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>💰</span>
                    <span>Requisition Budget for this Complaint</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* VIEW 2: COMPLAINTS & GRIEVANCES */}
          {/* ========================================================================= */}
          {activeSection === "complaints" && (
            <div className="flex-1 min-w-0 flex flex-col p-3.5 md:p-4 lg:p-5 h-full overflow-hidden space-y-3">
              {/* Header & Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 shrink-0">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>📋</span>
                    <span>Area Grievances & Service Complaints</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Complaints recorded in {officer.jurisdiction?.name} under your administrative jurisdiction.
                  </p>
                </div>

                {/* Segmented Filter Control Bar */}
                <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl shrink-0 overflow-x-auto max-w-full">
                  {[
                    { id: "all", label: "All" },
                    { id: "active", label: "Active" },
                    { id: "escalated", label: "Escalated" },
                    { id: "inspection", label: "Scheduled" },
                    { id: "resolved", label: "Resolved" }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setComplaintFilter(f.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        complaintFilter === f.id
                          ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20 font-bold"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full max-w-md shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                  🔍
                </div>
                <input
                  type="text"
                  placeholder="Search grievance ID, road name, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
                />
              </div>

              {/* Complaints Table Container with internal viewport scroll */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex-1 flex flex-col min-h-0">
                <div className="overflow-auto flex-1">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-900 text-slate-300 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-800">
                        <th className="py-2.5 px-2.5 sm:px-3 whitespace-nowrap w-36 sm:w-40">Grievance & Type</th>
                        <th className="py-2.5 px-2.5 sm:px-3 min-w-[130px] max-w-[220px]">Location & Description</th>
                        <th className="py-2.5 px-2.5 sm:px-3 whitespace-nowrap w-24 sm:w-28">Status</th>
                        <th className="py-2.5 px-2.5 sm:px-3 whitespace-nowrap w-20 sm:w-24">Trust & SLA</th>
                        <th className="py-2.5 px-2.5 sm:px-3 whitespace-nowrap w-20 sm:w-24">Linked Budget</th>
                        <th className="py-2.5 px-2.5 sm:px-3 text-right whitespace-nowrap w-32 sm:w-36 pr-3 sm:pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-slate-200">
                      {filteredComplaints.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500">
                            No complaints match the current criteria in this jurisdiction.
                          </td>
                        </tr>
                      ) : (
                        filteredComplaints.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-850/60 transition-colors">
                            <td className="py-2 px-2.5 sm:px-3 whitespace-nowrap w-36 sm:w-40">
                              <div className="flex items-center gap-2">
                                <span className="text-xl shrink-0">{ISSUE_ICONS[c.issue_type] || "📍"}</span>
                                <div className="min-w-0">
                                  <span className="font-semibold text-slate-100 block truncate">{c.issue_type}</span>
                                  <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[95px] sm:max-w-[115px]">{c.complaint_id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-2.5 sm:px-3 min-w-[130px] max-w-[220px]">
                              <span className="font-semibold text-slate-100 block truncate" title={c.street ? `${c.street}, ${c.place_name}` : c.place_name}>
                                {c.street ? `${c.street}, ${c.place_name || "Location"}` : c.place_name || "Location"}
                              </span>
                              {c.address && (
                                <span className="text-[10px] font-mono text-slate-500 block truncate mt-0.5" title={c.address}>
                                  {c.address}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400 block truncate mt-0.5">{c.description}</span>
                            </td>
                            <td className="py-2 px-2.5 sm:px-3 whitespace-nowrap w-24 sm:w-28">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  ["Resolved", "Closed"].includes(c.status)
                                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                    : c.escalated
                                    ? "bg-rose-500/15 border-rose-500/40 text-rose-300 animate-pulse"
                                    : "bg-amber-500/15 border-amber-500/40 text-amber-300"
                                }`}
                              >
                                {c.status}
                              </span>
                              {c.scheduled_inspection && (
                                <span className="block text-[10px] text-cyan-400 mt-0.5 font-medium">
                                  📅 {c.scheduled_inspection}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 sm:px-3 whitespace-nowrap font-mono w-20 sm:w-24">
                              <span className="text-emerald-400 font-semibold block">{c.user_trust_score || 80} Trust</span>
                              <span className="text-[10px] text-slate-400">Open {c.days_open || 1}d</span>
                            </td>
                            <td className="py-2 px-2.5 sm:px-3 whitespace-nowrap w-20 sm:w-24">
                              {c.linked_funds?.length > 0 ? (
                                <span className="text-amber-300 font-bold font-mono text-[11px] bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded inline-block">
                                  ₹{c.linked_funds[0].amount?.toLocaleString("en-IN")}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">None</span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 sm:px-3 text-right whitespace-nowrap w-32 sm:w-36 pr-3 sm:pr-4">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedComplaint(c);
                                    setActionType("status_change");
                                    setActionStatus("In Progress");
                                    setShowActionModal(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-semibold text-xs border border-amber-500/30 transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                >
                                  Take Action
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedComplaint(c);
                                    setShowForwardModal(true);
                                  }}
                                  className="p-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors cursor-pointer shrink-0"
                                  title="Forward to Senior Authority"
                                >
                                  ↗
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 3: FUND REQUISITIONS & BUDGETS */}
          {/* ========================================================================= */}
          {activeSection === "funds" && (
            <div className="flex-1 min-w-0 flex flex-col p-4 lg:p-6 overflow-y-auto space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 shrink-0">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>💰</span>
                    <span>Civic Fund Requisitions & Maintenance Budgets</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Submit and review financial budget allocations for emergency infrastructure repairs.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setFundComplaintId("");
                    setFundTitle("");
                    setShowFundModal(true);
                  }}
                  className="shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <span>+</span>
                  <span>Raise New Fund Request</span>
                </button>
              </div>

              {/* Fund Requisition Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {funds.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                    No active fund requests in this jurisdiction.
                  </div>
                ) : (
                  funds.map((f, i) => (
                    <div key={i} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 flex flex-col justify-between gap-4 shadow-xl hover:border-slate-700 transition-all">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="font-mono text-[11px] font-semibold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {f.id}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              f.status === "Approved" || f.status === "Disbursed"
                                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                : f.status === "Rejected"
                                ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                                : "bg-amber-500/15 border-amber-500/40 text-amber-300"
                            }`}
                          >
                            {f.status}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-100 mb-1 leading-snug">{f.title}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">{f.justification}</p>

                        <div className="space-y-1.5 text-xs border-t border-slate-800/80 pt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-[11px]">Amount Requisitioned:</span>
                            <strong className="text-amber-400 text-sm font-mono font-bold">
                              ₹{Number(f.amount).toLocaleString("en-IN")}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Budget Head:</span>
                            <span className="text-slate-300 font-medium truncate max-w-[180px]">{f.budget_head}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Initiated By:</span>
                            <span className="text-slate-300 font-medium truncate max-w-[180px]">{f.officer_name}</span>
                          </div>
                          {f.approved_by && (
                            <div className="flex items-center justify-between text-[11px] text-emerald-400 pt-0.5">
                              <span className="text-emerald-400/80">Approved By:</span>
                              <span className="font-semibold truncate max-w-[180px]">{f.approved_by}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Senior Officer Approval Actions */}
                      {["national", "state", "district", "zone"].includes(officer.level) && f.status === "Under Review" && (
                        <div className="pt-3 border-t border-slate-800 flex gap-2">
                          <button
                            onClick={() => handleReviewFund(f.id, "approve")}
                            className="flex-1 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Approve Budget
                          </button>
                          <button
                            onClick={() => handleReviewFund(f.id, "reject")}
                            className="py-2 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 4: OFFICIAL INTER-DEPARTMENT MAIL & MEMOS */}
          {/* ========================================================================= */}
          {activeSection === "memos" && (
            <div className="flex-1 min-w-0 flex flex-col p-4 lg:p-6 overflow-y-auto space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 shrink-0">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>✉️</span>
                    <span>Inter-Departmental Mail & Official Notices</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Issue direct memos and coordinate joint actions with Jal Kal, PWD, DISCOM, Police, and Development Authorities.
                  </p>
                </div>

                <button
                  onClick={() => setShowMemoModal(true)}
                  className="shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <span>✉️</span>
                  <span>Dispatch Official Memo</span>
                </button>
              </div>

              {/* Memos List */}
              <div className="space-y-3">
                {memos.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                    No official letters or memos recorded in this dispatch ledger.
                  </div>
                ) : (
                  memos.map((m, i) => (
                    <div key={i} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-xl hover:border-slate-700 transition-all">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                            {m.memo_no}
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-xs text-slate-200 font-medium">To: <strong className="text-white">{m.recipient_authority_name}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-semibold">
                            {m.priority}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(m.sent_at).toLocaleDateString("en-IN")}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-white leading-snug">{m.subject}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">{m.body}</p>

                      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Issued by: <strong className="text-slate-300">{m.sender_name}</strong> ({m.sender_dept})</span>
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <span>✓</span>
                          <span>Dispatched & Audited</span>
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 5: JUNIOR OFFICERS & HIERARCHY MANAGEMENT */}
          {/* ========================================================================= */}
          {activeSection === "subordinates" && (
            <div className="flex-1 min-w-0 flex flex-col p-4 lg:p-6 overflow-y-auto space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 shrink-0">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>👥</span>
                    <span>Subordinate Officers & Administrative Oversight</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Monitor handles, assign field tasks, and issue ward transfer orders to junior officers under your authority.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => {
                      if (subordinates.length > 0) setTaskTargetSubordinate(subordinates[0].id);
                      setShowTaskModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>+</span>
                    <span>Assign Direct Directive</span>
                  </button>
                  <button
                    onClick={() => {
                      if (subordinates.length > 0) setTransferOfficerId(subordinates[0].id);
                      setShowTransferModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>🔄</span>
                    <span>Transfer Officer</span>
                  </button>
                </div>
              </div>

              {/* Subordinates Directory Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {subordinates.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                    You are at the field frontline level. There are no junior officers under your administrative tier.
                  </div>
                ) : (
                  subordinates.map((sub, i) => (
                    <div key={i} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-3 shadow-xl hover:border-slate-700 transition-all">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                            {sub.badge}
                          </span>
                          <span className="text-xs text-amber-400 font-mono font-bold flex items-center gap-1">
                            <span>⭐</span>
                            <span>{sub.workload?.rating}</span>
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-white leading-snug">{sub.name}</h4>
                        <p className="text-xs text-slate-400 leading-snug mt-0.5">{sub.designation}</p>

                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Assigned Ward:</span>
                            <span className="font-semibold text-cyan-300 truncate max-w-[160px]">
                              {sub.jurisdiction?.name}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Active Grievances:</span>
                            <span className="font-mono text-slate-200 font-semibold">{sub.workload?.open_complaints} open</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Resolution Rate:</span>
                            <span className="font-mono text-emerald-400 font-semibold">{sub.workload?.resolution_rate}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Official Contact:</span>
                            <span className="font-mono text-slate-300 text-[11px]">{sub.phone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex gap-2">
                        <button
                          onClick={() => {
                            setTaskTargetSubordinate(sub.id);
                            setShowTaskModal(true);
                          }}
                          className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-colors cursor-pointer"
                        >
                          Send Task
                        </button>
                        <button
                          onClick={() => {
                            setTransferOfficerId(sub.id);
                            setShowTransferModal(true);
                          }}
                          className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                        >
                          Transfer
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 6: AREA SCORECARD & ANALYTICS */}
          {/* ========================================================================= */}
          {activeSection === "scorecard" && scorecard && (
            <div className="flex-1 min-w-0 flex flex-col p-4 lg:p-6 overflow-y-auto space-y-6">
              <div className="pb-3 border-b border-slate-800">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>📊</span>
                  <span>Jurisdiction Performance & Area Rating Scorecard</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comprehensive performance audit and citizen rating metrics for {officer.jurisdiction?.name}.
                </p>
              </div>

              {/* KPI Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Civic Quality Index
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
                      {scorecard.civic_quality_score}
                    </span>
                    <span className="text-xs text-slate-400">/ 100</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium mt-1 block">Grade A Governance</span>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Citizen Satisfaction
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-cyan-400 font-mono">
                      {scorecard.citizen_satisfaction_rating}
                    </span>
                    <span className="text-xs text-slate-400">★ out of 5</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Based on verification reviews</span>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    SLA On-Time Rate
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
                      {scorecard.sla_compliance_rate}%
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 mt-1 block">Within 72hr deadline</span>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Total Handled
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono">
                      {scorecard.metrics?.total_complaints || 0}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {scorecard.metrics?.resolved_complaints || 0} resolved
                  </span>
                </div>
              </div>

              {/* Category Breakdown Bars */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
                <h4 className="text-sm font-bold text-white mb-3">Civic Issues Breakdown</h4>
                <div className="space-y-3">
                  {Object.entries(scorecard.category_breakdown || {}).map(([cat, cnt], idx) => {
                    const total = scorecard.metrics?.total_complaints || 1;
                    const pct = Math.round((cnt / total) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-300 flex items-center gap-1.5">
                            <span>{ISSUE_ICONS[cat] || "📍"}</span>
                            <span>{cat}</span>
                          </span>
                          <span className="font-mono text-slate-400">{cnt} cases ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: TAKE ACTION ON COMPLAINT */}
      {/* ========================================================================= */}
      {showActionModal && selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 my-auto relative animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>Take Administrative Action</span>
                </h3>
                <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                  ID: {selectedComplaint.complaint_id} • {selectedComplaint.issue_type}
                </p>
              </div>
              <button
                onClick={() => setShowActionModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Select Action</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 outline-none transition-colors"
                >
                  <option value="status_change">Progress Workflow Status</option>
                  <option value="schedule_inspection">Schedule Field Inspection</option>
                  <option value="reject">Reject with Official Justification</option>
                </select>
              </div>

              {actionType === "status_change" && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">New Status</label>
                  <select
                    value={actionStatus}
                    onChange={(e) => setActionStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 outline-none transition-colors"
                  >
                    <option value="Verified">Verified by Field Officer</option>
                    <option value="In Progress">Work In Progress / Execution</option>
                    <option value="Inspection Scheduled">Inspection Scheduled</option>
                    <option value="Resolved">Mark Completed / Resolved</option>
                  </select>
                </div>
              )}

              {actionType === "schedule_inspection" && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Inspection Date</label>
                  <input
                    type="date"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 outline-none transition-colors"
                  />
                </div>
              )}

              {actionType === "reject" ? (
                <div>
                  <label className="block text-rose-300 font-medium mb-1.5">Mandatory Rejection Reason</label>
                  <textarea
                    rows={3}
                    placeholder="Provide official reason why this complaint cannot be processed..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full bg-slate-950 border border-rose-500/40 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/40 rounded-xl p-2.5 text-slate-200 placeholder-slate-500 outline-none transition-colors"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Action Remarks / Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Enter official execution or inspection notes..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 placeholder-slate-500 outline-none transition-colors"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setShowActionModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAdvanceStatus}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                Execute Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FORWARD TO UPPER SECTION */}
      {/* ========================================================================= */}
      {showForwardModal && selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 my-auto relative animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>↗</span>
                  <span>Forward Complaint to Upper Hierarchy</span>
                </h3>
                <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                  ID: {selectedComplaint.complaint_id} • {selectedComplaint.place_name}
                </p>
              </div>
              <button
                onClick={() => setShowForwardModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Target Administrative Tier</label>
                <select
                  value={forwardTargetLevel}
                  onChange={(e) => setForwardTargetLevel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 outline-none transition-colors"
                >
                  <option value="zone">Zonal Executive Office</option>
                  <option value="district">District Magistrate (DM) / Municipal Commissioner</option>
                  <option value="state">State Urban Development Directorate</option>
                  <option value="national">MoHUA Apex Central Command</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Urgency Level</label>
                <select
                  value={forwardUrgency}
                  onChange={(e) => setForwardUrgency(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 outline-none transition-colors"
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical (Immediate Inter-Department Notice)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Escalation Justification</label>
                <textarea
                  rows={3}
                  placeholder="Explain why this requires senior intervention (e.g. jurisdiction dispute, budget shortage, utility overlap)..."
                  value={forwardJustification}
                  onChange={(e) => setForwardJustification(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 placeholder-slate-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setShowForwardModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleForwardUpper}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
              >
                Submit Escalation Memo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RAISE FUND REQUEST */}
      {/* ========================================================================= */}
      {showFundModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 my-auto relative animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>💰</span>
                  <span>Raise Civic Maintenance Fund Requisition</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Budget will be audited and routed according to administrative threshold rules.
                </p>
              </div>
              <button
                onClick={() => setShowFundModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Requisition Title</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency Bitumen Resurfacing on Naubasta Arterial"
                  value={fundTitle}
                  onChange={(e) => setFundTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 placeholder-slate-500 outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Required Amount (₹ INR)</label>
                  <input
                    type="number"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-amber-300 font-mono font-bold outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Urgency</label>
                  <select
                    value={fundUrgency}
                    onChange={(e) => setFundUrgency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 outline-none transition-colors"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Budget Head</label>
                <select
                  value={fundBudgetHead}
                  onChange={(e) => setFundBudgetHead(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 outline-none transition-colors"
                >
                  <option value="Emergency Road & Drainage Restoration">Emergency Road & Drainage Restoration</option>
                  <option value="Solid Waste & Compactor Replacement">Solid Waste & Compactor Replacement</option>
                  <option value="Underground Sewer Conduit Overhaul">Underground Sewer Conduit Overhaul</option>
                  <option value="Smart City LED Lighting & Feeder Repair">Smart City LED Lighting & Feeder Repair</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Technical Justification</label>
                <textarea
                  rows={2}
                  placeholder="Technical justification and engineer recommendation..."
                  value={fundJustification}
                  onChange={(e) => setFundJustification(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 placeholder-slate-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setShowFundModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFund}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                Submit Requisition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DISPATCH OFFICIAL MEMO */}
      {/* ========================================================================= */}
      {showMemoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 my-auto relative animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>✉️</span>
                  <span>Dispatch Official Inter-Department Memo</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Legally logged under UP Public Services Framework.
                </p>
              </div>
              <button
                onClick={() => setShowMemoModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Recipient Authority</label>
                <select
                  value={memoRecipientId}
                  onChange={(e) => setMemoRecipientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl p-2.5 text-slate-200 outline-none transition-colors"
                >
                  {AUTHORITIES_LIST.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Joint Site Inspection: Underground pipeline leakage"
                  value={memoSubject}
                  onChange={(e) => setMemoSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl p-2.5 text-slate-200 placeholder-slate-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Priority</label>
                <select
                  value={memoPriority}
                  onChange={(e) => setMemoPriority(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl p-2.5 text-slate-200 outline-none transition-colors"
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent (48 Hour Response)</option>
                  <option value="Immediate">Immediate / Emergency Directive</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Official Memo Content</label>
                <textarea
                  rows={4}
                  placeholder="Enter formal notice text and directives..."
                  value={memoBody}
                  onChange={(e) => setMemoBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl p-2.5 text-slate-200 placeholder-slate-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setShowMemoModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMemo}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
              >
                Dispatch Memo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ASSIGN DIRECT TASK TO SUBORDINATE */}
      {/* ========================================================================= */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 my-auto relative animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>Assign Official Directive to Subordinate</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Direct task delegated with administrative accountability tracking.
                </p>
              </div>
              <button
                onClick={() => setShowTaskModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Assignee (Junior Officer)</label>
                <select
                  value={taskTargetSubordinate}
                  onChange={(e) => setTaskTargetSubordinate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 outline-none transition-colors"
                >
                  {subordinates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.designation} - {s.jurisdiction?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Directive Title</label>
                <input
                  type="text"
                  placeholder="e.g. Execute urgent road recarpeting by 5 PM"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 placeholder-slate-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Instructions & Terms</label>
                <textarea
                  rows={3}
                  placeholder="Specific instructions, inspection checklist, and deadlines..."
                  value={taskInstructions}
                  onChange={(e) => setTaskInstructions(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 placeholder-slate-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setShowTaskModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignTask}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                Issue Directive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: TRANSFER JUNIOR OFFICER */}
      {/* ========================================================================= */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 my-auto relative animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>🔄</span>
                  <span>Issue Officer Transfer Order</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Official reallocation of municipal personnel within jurisdiction.
                </p>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Select Subordinate Officer</label>
                <select
                  value={transferOfficerId}
                  onChange={(e) => setTransferOfficerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 outline-none transition-colors"
                >
                  {subordinates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Current: {s.jurisdiction?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">New Assigned Ward / Jurisdiction</label>
                <input
                  type="text"
                  placeholder="e.g. Ward 45 (Govind Nagar)"
                  value={transferWardName}
                  onChange={(e) => setTransferWardName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 placeholder-slate-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Transfer Justification</label>
                <textarea
                  rows={2}
                  placeholder="Administrative reason for transfer..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl p-2.5 text-slate-200 placeholder-slate-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferOfficer}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                Issue Transfer Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
