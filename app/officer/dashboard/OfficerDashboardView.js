"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import { 
  ChevronLeft, 
  ChevronRight, 
  Sun, 
  Moon, 
  Map as MapIcon, 
  Layers, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Send, 
  Plus, 
  LogOut, 
  Users, 
  BarChart3, 
  DollarSign, 
  Mail, 
  Building2, 
  ArrowUpRight, 
  FileText, 
  RefreshCw, 
  ShieldCheck, 
  Check, 
  X,
  SlidersHorizontal
} from "lucide-react";

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

  // Active navigation section: "map", "aqi", "complaints", "funds", "memos", "subordinates", "scorecard"
  const [activeSection, setActiveSection] = useState("map");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState("dark");

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

  // Hydrate theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("nirikshan_theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("nirikshan_theme", next);
  };

  // Responsive sidebar handling
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

  // Fetch officer data
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

  // Fast switch identity for testing
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

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || !officer) return;

    if (!mapInstanceRef.current) {
      const centerLat = officer.jurisdiction?.lat || 26.8467;
      const centerLng = officer.jurisdiction?.lng || 80.9462;
      const initialZoom = officer.jurisdiction?.zoom || 13;

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: initialZoom,
        zoomControl: false,
        preferCanvas: true
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      const getTileUrl = (themeMode) => {
        if (themeMode === "street") return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
        if (themeMode === "satellite") return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
        return "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
      };

      const tileLayer = L.tileLayer(getTileUrl(mapTheme), {
        attribution: "&copy; Nirikshan Spatial Gov",
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
      mapInstanceRef.current.tileLayer = tileLayer;
      
      const refLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
        pane: 'markerPane'
      });
      referenceLayerRef.current = refLayer;
      if (mapTheme === "dark") {
        refLayer.addTo(map);
      }

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;

      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
      map._resizeObserver = resizeObserver;
    } else {
      const { lat, lng, zoom } = officer.jurisdiction || { lat: 26.8467, lng: 80.9462, zoom: 13 };
      mapInstanceRef.current.setView([lat, lng], zoom);
      setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 100);
    }

    return () => {
      if (mapInstanceRef.current && mapInstanceRef.current._resizeObserver) {
        mapInstanceRef.current._resizeObserver.disconnect();
      }
    };
  }, [officer, mapTheme]);

  // Update map tiles
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

  // Render complaint markers
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
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full border shadow-lg transition-transform hover:scale-125" style="
          background: ${isResolved ? 'rgba(16, 185, 129, 0.85)' : isEscalated ? 'rgba(244, 63, 94, 0.85)' : 'rgba(13, 17, 23, 0.85)'};
          backdrop-filter: blur(8px);
          border: 2px solid ${isResolved ? '#10b981' : isEscalated ? '#f43f5e' : 'var(--accent-1)'};
          box-shadow: 0 4px 14px ${isResolved ? 'rgba(16, 185, 129, 0.4)' : isEscalated ? 'rgba(244, 63, 94, 0.4)' : 'rgba(34, 211, 238, 0.4)'};
        ">
          <span style="font-size: 14px;">${iconEmoji}</span>
          ${isEscalated ? `<span style="position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; background: #f43f5e; border-radius: 50%; border: 1.5px solid #fff;"></span>` : ""}
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
        <div style="font-family: var(--font-body); min-width: 250px; color: var(--text-primary); padding: 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <strong style="color: var(--accent-1); font-size: 14px; font-family: var(--font-title); display: flex; align-items: center; gap: 6px;">${iconEmoji} ${c.issue_type}</strong>
            <span class="badge-status ${isResolved ? 'resolved' : 'inprogress'}">${c.status}</span>
          </div>
          
          <p style="font-size: 13px; margin: 0 0 4px 0; font-weight: 700; color: var(--text-primary);">${c.street ? c.street + ', ' : ''}${c.place_name || "Civic Spot"}</p>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 12px 0; line-height: 1.4;">${c.description}</p>
          
          ${hasImage ? `
            <div style="margin-bottom: 12px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-primary);">
              <img src="${c.image_url}" alt="Complaint image" style="width: 100%; height: 130px; object-fit: cover; display: block;" />
            </div>
          ` : ''}
          
          <div style="display: flex; justify-content: space-between; gap: 8px; font-size: 10px; color: var(--text-muted); border-top: 1px solid var(--border-primary); padding-top: 8px;">
            <span>Trust Score: <strong style="color: var(--green);">${c.user_trust_score || 80}</strong></span>
            <span>Open: <strong style="color: var(--text-primary);">${c.days_open || 1}d</strong></span>
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

  // Load boundary geojson
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
            color: "var(--accent-1)",
            weight: 2.5,
            dashArray: "5, 7",
            fillColor: "var(--accent-1)",
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

  // Actions
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
    if (score >= 81) return "var(--green)"; // excellent
    if (score >= 61) return "#84cc16"; // good
    if (score >= 31) return "var(--yellow)"; // moderate
    return "var(--red)"; // critical
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
          color: "var(--glass-border)",
          weight: 1.5,
          fillOpacity: 0.45,
          className: "aqi-region"
        };
      },
      onEachFeature: (feature, childLayer) => {
        const areaName = feature.properties.name || "Administrative Area";
        childLayer.bindTooltip(`
          <div style="font-family: var(--font-body); font-size: 12px; font-weight: 500; color: var(--text-primary); padding: 4px;">
            <div style="font-weight: 700; margin-bottom: 2px;">${areaName}</div>
            <div style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: rgba(34, 211, 238, 0.15); color: var(--accent-1); display: inline-block;">
              AQI Score: ${feature.properties.area_score}
            </div>
          </div>
        `, { sticky: true });

        childLayer.on("mouseover", () => {
          setHoveredArea({
            name: areaName,
            level: level,
            score: feature.properties.area_score,
            status: feature.properties.area_status || "Standard",
            authority: feature.properties.authority,
            city: feature.properties.city
          });
          if (typeof childLayer.setStyle === "function") {
            childLayer.setStyle({ color: "var(--accent-1)", weight: 2.5 });
          }
        });

        childLayer.on("mouseout", () => {
          setHoveredArea(null);
          if (typeof childLayer.setStyle === "function") {
            childLayer.setStyle({ color: "var(--glass-border)", weight: 1.5 });
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
      if (markersGroupRef.current && !map.hasLayer(markersGroupRef.current)) {
        markersGroupRef.current.addTo(map);
      }
    }

    if (activeSection === "map" || activeSection === "aqi") {
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100);
    }
  }, [activeSection, refreshAqiLayer]);

  if (!officer) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent-1)", borderTopColor: "transparent" }}></div>
          <p className="text-sm font-semibold tracking-wide" style={{ color: "var(--accent-1)", fontFamily: "var(--font-title)" }}>
            Loading Nirikshan Command Console...
          </p>
        </div>
      </div>
    );
  }

  // Summary counts for HUD stats
  const pendingCount = complaints.filter(c => !["Resolved", "Closed"].includes(c.status)).length;
  const resolvedCount = complaints.filter(c => ["Resolved", "Closed"].includes(c.status)).length;
  const escalatedCount = complaints.filter(c => c.escalated).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Toast Notification */}
      {notification && (
        <div 
          className="fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 shadow-2xl animate-in fade-in slide-in-from-top-2"
          style={{
            background: notification.type === "error" ? "var(--red-bg)" : "var(--glass-bg-strong)",
            borderColor: notification.type === "error" ? "var(--red-border)" : "var(--glass-border)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            color: notification.type === "error" ? "var(--red)" : "var(--accent-1)"
          }}
        >
          <span>{notification.type === "error" ? "⚠️" : notification.type === "info" ? "ℹ️" : "✓"}</span>
          <span>{notification.msg}</span>
        </div>
      )}

      {/* FLOATING SIDEBAR (matches user portal sidebar design) */}
      <aside className={`sidebar ${sidebarCollapsed ? 'w-[80px]' : 'w-[280px] xl:w-[300px]'}`}>
        {/* Toggle Button */}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="sidebar-toggle"
          title="Toggle Sidebar"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Sidebar Brand Header */}
        <div className={`transition-all duration-300 ${sidebarCollapsed ? 'py-5 flex justify-center items-center' : 'p-6'}`}>
          {sidebarCollapsed ? (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-md cursor-pointer hover:scale-105 transition-transform" 
                 onClick={() => setSidebarCollapsed(false)}
                 title="Expand Sidebar"
                 style={{ background: "var(--accent-gradient-vibrant)", color: "#ffffff" }}>
              N
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold m-0 flex items-center gap-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                <span className="sidebar-brand-dot"></span>
                <span className="sidebar-brand-title">Nirikshan Command</span>
              </h1>
              <p className="sidebar-brand-subtitle mt-1 ml-4 whitespace-nowrap">
                Administrative Oversight Console
              </p>
            </>
          )}
        </div>

        {/* Navigation Links */}
        <nav className={`flex flex-col gap-1.5 mt-1 ${sidebarCollapsed ? 'px-2' : 'px-4'} transition-all overflow-y-auto flex-1 min-h-0`}>
          {[
            { id: "map", label: "Command Map", icon: "🗺️", count: null },
            { id: "aqi", label: "AQI Area Score", icon: "🍃", count: null },
            { id: "complaints", label: "Area Grievances", icon: "📋", count: complaints.length },
            { id: "funds", label: "Fund Requisitions", icon: "💰", count: funds.length },
            { id: "memos", label: "Official Memos", icon: "✉️", count: memos.length },
            { id: "subordinates", label: "Junior Officers", icon: "👥", count: subordinates.length },
            { id: "scorecard", label: "Area Scorecard", icon: "📊", count: null }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              title={item.label}
              className={`sidebar-nav-btn ${activeSection === item.id ? "active" : ""} ${sidebarCollapsed ? 'justify-center px-3' : ''}`}
            >
              <span className="text-lg shrink-0">{item.icon}</span>
              {!sidebarCollapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!sidebarCollapsed && item.count !== null && (
                <span 
                  className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold"
                  style={{
                    background: activeSection === item.id ? "rgba(var(--accent-1-rgb), 0.25)" : "var(--glass-inner-bg)",
                    color: activeSection === item.id ? "var(--text-primary)" : "var(--text-muted)",
                    border: "1px solid var(--border-subtle)"
                  }}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer Area Scorecard */}
        {!sidebarCollapsed && scorecard && (
          <div className="p-4 m-4 glass-inner rounded-2xl shrink-0">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Civic Quality Index</span>
              <span className="font-bold font-mono" style={{ color: "var(--accent-1)", fontFamily: "var(--font-title)" }}>
                {scorecard.civic_quality_score}/100
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden mb-2.5" style={{ background: "var(--border-primary)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${scorecard.civic_quality_score}%`,
                  background: "var(--accent-gradient-vibrant)"
                }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--text-muted)" }}>
              <span>⭐ {scorecard.citizen_satisfaction_rating} Rating</span>
              <span>⚡ {scorecard.sla_compliance_rate}% SLA</span>
            </div>
          </div>
        )}
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {/* TOP NAVBAR (matches user portal navbar) */}
        <header className="navbar">
          {/* Left: Department & Jurisdiction details */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm truncate" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                  {officer.department}
                </span>
                <span className="officer-badge-pill shrink-0">
                  {officer.level}
                </span>
              </div>
              <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Jurisdiction: <strong style={{ color: "var(--accent-1)" }}>{officer.jurisdiction?.name}</strong> • {officer.jurisdiction?.type?.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Right: Quick Switcher, Theme Toggle, Profile & Logout */}
          <div className="flex items-center gap-3 shrink-0">
            {/* 1-Click Fast Hierarchy Switcher */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Test Tier:</span>
              <select
                value={officer.email}
                onChange={(e) => handleQuickSwitch(e.target.value)}
                className="glass-select"
                style={{
                  padding: "6px 12px",
                  fontSize: "0.78rem",
                  borderRadius: "999px",
                  maxWidth: "210px"
                }}
                title="Instant switch to any administrative tier"
              >
                {HIERARCHY_PRESETS.map((p, i) => (
                  <option key={i} value={p.email}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Theme Toggle Button */}
            <button 
              onClick={toggleTheme}
              className="theme-toggle"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Officer Profile Card & Logout */}
            <div className="flex items-center gap-2.5 pl-2" style={{ borderLeft: "1px solid var(--border-primary)" }}>
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                  color: "#fff"
                }}
              >
                {officer.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
              </div>
              <div className="hidden md:block text-left leading-none max-w-[140px]">
                <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>{officer.name}</p>
                <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--accent-1)" }}>{officer.badge}</p>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-xl transition-all cursor-pointer"
                style={{
                  background: "var(--red-bg)",
                  color: "var(--red)",
                  border: "1px solid var(--red-border)"
                }}
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* WORKSPACE VIEW AREA */}
        <main className="flex-1 relative overflow-hidden w-full h-full p-0 min-h-0">
          {/* ========================================================================= */}
          {/* VIEW 1: COMMAND MAP & AQI VIEW */}
          {/* ========================================================================= */}
          <div className={`w-full h-full relative ${activeSection === "map" || activeSection === "aqi" ? "block" : "hidden"}`}>
            {/* Live Location / Hovered Area Preview HUD (matches user portal HUD) */}
            <div className="location-preview-hud">
              {hoveredArea ? (
                <div className="hud-content">
                  <div className="hud-indicator" style={{ background: scoreToColor(hoveredArea.score), color: scoreToColor(hoveredArea.score) }}></div>
                  <div className="hud-text">
                    <span className="hud-name">{hoveredArea.name}</span>
                    <span className="hud-sub">
                      {hoveredArea.level ? hoveredArea.level.replace("-", " ").toUpperCase() : "AREA"} • AQI: <strong>{hoveredArea.score}</strong> ({hoveredArea.status})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="hud-content">
                  <span className="hud-icon">🧭</span>
                  <span className="hud-text-idle">Hover over any boundary or click a complaint marker to inspect</span>
                </div>
              )}
            </div>

            {/* Map Theme & Mode Controls (Floating top-left HUD) */}
            <div className="map-mode-control" style={{ top: 72 }}>
              <h4>Map Mode & Visual Layer</h4>
              <div className="mode-buttons mb-2">
                <button 
                  className={`mode-btn ${activeSection === "map" ? "active" : ""}`}
                  onClick={() => setActiveSection("map")}
                >
                  📍 Grievances
                </button>
                <button 
                  className={`mode-btn ${activeSection === "aqi" ? "active" : ""}`}
                  onClick={() => setActiveSection("aqi")}
                >
                  🍃 AQI Quality
                </button>
              </div>
              <div className="flex items-center gap-1.5 pt-1.5" style={{ borderTop: "1px solid var(--border-primary)" }}>
                <button 
                  className={`sidebar-theme-btn ${mapTheme === "dark" ? "active" : ""}`}
                  onClick={() => setMapTheme("dark")}
                >
                  Dark
                </button>
                <button 
                  className={`sidebar-theme-btn ${mapTheme === "street" ? "active" : ""}`}
                  onClick={() => setMapTheme("street")}
                >
                  Street
                </button>
                <button 
                  className={`sidebar-theme-btn ${mapTheme === "satellite" ? "active" : ""}`}
                  onClick={() => setMapTheme("satellite")}
                >
                  Satellite
                </button>
              </div>
            </div>

            {/* Stats Row (matches user portal stats-row) */}
            <div className="stats-row">
              <article>
                <strong>{complaints.length}</strong>
                <span>Total Grievances</span>
              </article>
              <article>
                <strong style={{ color: "var(--yellow)" }}>{pendingCount}</strong>
                <span>In Progress</span>
              </article>
              <article>
                <strong style={{ color: "var(--red)" }}>{escalatedCount}</strong>
                <span>Escalated</span>
              </article>
              <article>
                <strong style={{ color: "var(--green)" }}>{resolvedCount}</strong>
                <span>Resolved</span>
              </article>
            </div>

            {/* Map Legend Card for AQI Mode */}
            {activeSection === "aqi" && !selectedComplaint && (
              <div className="legend-card">
                <h3>Area Quality Index (AQI)</h3>
                <p>Jurisdiction Heat Gradient</p>
                <div className="legend-scale">
                  <div className="scale-item"><span className="swatch excellent"></span><strong>81-100</strong> Well-maintained</div>
                  <div className="scale-item"><span className="swatch good"></span><strong>61-80</strong> Acceptable</div>
                  <div className="scale-item"><span className="swatch moderate"></span><strong>31-60</strong> Needs Attention</div>
                  <div className="scale-item"><span className="swatch critical"></span><strong>0-30</strong> Critical Concern</div>
                </div>
              </div>
            )}

            {/* Map Container */}
            <div ref={mapContainerRef} className="absolute inset-0 z-0"></div>

            {/* Slide-in Complaint Drawer */}
            {selectedComplaint && (
              <div 
                className="officer-drawer absolute top-4 right-4 z-30 w-96 max-w-[calc(100vw-2rem)] p-5 shadow-2xl animate-in slide-in-from-right duration-200"
              >
                <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{ISSUE_ICONS[selectedComplaint.issue_type] || "📍"}</span>
                    <div>
                      <h4 className="text-sm font-bold leading-tight" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                        {selectedComplaint.issue_type}
                      </h4>
                      <p className="text-xs" style={{ color: "var(--accent-1)" }}>{selectedComplaint.place_name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedComplaint(null)}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="py-3.5 space-y-3 text-xs">
                  <p style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {selectedComplaint.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-xl glass-inner">
                      <span className="block text-[10px] uppercase font-bold" style={{ color: "var(--text-muted)" }}>CURRENT STATUS</span>
                      <span className="font-bold" style={{ color: "var(--accent-1)" }}>{selectedComplaint.status}</span>
                    </div>
                    <div className="p-2.5 rounded-xl glass-inner">
                      <span className="block text-[10px] uppercase font-bold" style={{ color: "var(--text-muted)" }}>TRUST SCORE</span>
                      <span className="font-bold font-mono" style={{ color: "var(--green)" }}>{selectedComplaint.user_trust_score || 80} / 100</span>
                    </div>
                  </div>

                  {selectedComplaint.escalated && (
                    <div 
                      className="p-2.5 rounded-xl text-[11px] flex items-center gap-2 font-medium"
                      style={{ background: "var(--red-bg)", border: "1px solid var(--red-border)", color: "var(--red)" }}
                    >
                      <AlertTriangle size={14} />
                      <span>Escalated Grievance (Priority Resolution Mandate)</span>
                    </div>
                  )}

                  {selectedComplaint.linked_funds?.length > 0 && (
                    <div 
                      className="p-2.5 rounded-xl text-[11px] font-mono font-medium"
                      style={{ background: "rgba(var(--accent-1-rgb), 0.1)", border: "1px solid rgba(var(--accent-1-rgb), 0.25)", color: "var(--accent-1)" }}
                    >
                      💰 Linked Budget: ₹{selectedComplaint.linked_funds[0].amount?.toLocaleString("en-IN")} ({selectedComplaint.linked_funds[0].status})
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t flex flex-col gap-2" style={{ borderColor: "var(--border-primary)" }}>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setActionType("status_change");
                        setActionStatus(selectedComplaint.status === "In Progress" ? "Resolved" : "In Progress");
                        setShowActionModal(true);
                      }}
                      className="btn-primary flex-1 py-2 text-xs"
                    >
                      Take Action
                    </button>
                    <button
                      onClick={() => setShowForwardModal(true)}
                      className="btn-secondary px-3.5 py-2 text-xs flex items-center justify-center gap-1"
                    >
                      Forward <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setFundComplaintId(selectedComplaint.complaint_id);
                      setFundTitle(`Emergency Restoration for ${selectedComplaint.issue_type} at ${selectedComplaint.place_name}`);
                      setShowFundModal(true);
                    }}
                    className="btn-secondary w-full py-2 text-xs flex items-center justify-center gap-1.5"
                    style={{ borderColor: "rgba(var(--accent-1-rgb), 0.3)", color: "var(--accent-1)" }}
                  >
                    <span>💰</span>
                    <span>Requisition Budget for this Grievance</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* VIEW 2: COMPLAINTS & GRIEVANCES */}
          {/* ========================================================================= */}
          {activeSection === "complaints" && (
            <div className="flex-1 min-w-0 flex flex-col p-4 sm:p-6 h-full overflow-hidden space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                    <span>📋</span>
                    <span>Area Grievances & Municipal Complaints</span>
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    Official complaints recorded within {officer.jurisdiction?.name} under your administrative jurisdiction.
                  </p>
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1.5 glass-inner p-1 rounded-2xl shrink-0 overflow-x-auto max-w-full">
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
                      className={`sidebar-theme-btn ${complaintFilter === f.id ? "active" : ""}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full max-w-md shrink-0">
                <input
                  type="text"
                  placeholder="Search grievance ID, road name, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="glass-input"
                  style={{ borderRadius: "999px", paddingLeft: "36px" }}
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              </div>

              {/* Table Container */}
              <div className="glass-panel overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="overflow-auto flex-1">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-10" style={{ background: "var(--glass-bg-strong)", borderBottom: "1px solid var(--border-primary)" }}>
                      <tr className="uppercase tracking-wider text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                        <th className="py-3 px-4 whitespace-nowrap">Grievance & Type</th>
                        <th className="py-3 px-4 min-w-[150px]">Location & Details</th>
                        <th className="py-3 px-4 whitespace-nowrap">Status</th>
                        <th className="py-3 px-4 whitespace-nowrap">Citizen Trust & SLA</th>
                        <th className="py-3 px-4 whitespace-nowrap">Linked Budget</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap pr-5">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                      {filteredComplaints.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-14 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                            No complaints match the selected filter in this jurisdiction.
                          </td>
                        </tr>
                      ) : (
                        filteredComplaints.map((c, i) => (
                          <tr key={i} className="transition-colors" style={{ "&:hover": { background: "var(--glass-inner-hover)" } }}>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <span className="text-xl shrink-0">{ISSUE_ICONS[c.issue_type] || "📍"}</span>
                                <div>
                                  <span className="font-bold block" style={{ color: "var(--text-primary)" }}>{c.issue_type}</span>
                                  <span className="text-[10px] font-mono block" style={{ color: "var(--text-muted)" }}>{c.complaint_id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 min-w-[150px]">
                              <span className="font-semibold block" style={{ color: "var(--text-primary)" }}>
                                {c.street ? `${c.street}, ${c.place_name || "Location"}` : c.place_name || "Location"}
                              </span>
                              <span className="text-[11px] block mt-0.5 truncate max-w-sm" style={{ color: "var(--text-secondary)" }}>
                                {c.description}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`badge-status ${["Resolved", "Closed"].includes(c.status) ? "resolved" : c.escalated ? "escalated" : "inprogress"}`}>
                                {c.status}
                              </span>
                              {c.scheduled_inspection && (
                                <span className="block text-[10px] mt-1 font-semibold" style={{ color: "var(--accent-1)" }}>
                                  📅 {c.scheduled_inspection}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-mono">
                              <span className="font-bold block" style={{ color: "var(--green)" }}>{c.user_trust_score || 80} Trust</span>
                              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Open {c.days_open || 1}d</span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {c.linked_funds?.length > 0 ? (
                                <span className="officer-badge-pill">
                                  ₹{c.linked_funds[0].amount?.toLocaleString("en-IN")}
                                </span>
                              ) : (
                                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>None</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap pr-5">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedComplaint(c);
                                    setActionType("status_change");
                                    setActionStatus("In Progress");
                                    setShowActionModal(true);
                                  }}
                                  className="btn-primary py-1 px-3 text-xs"
                                  style={{ width: "auto" }}
                                >
                                  Take Action
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedComplaint(c);
                                    setShowForwardModal(true);
                                  }}
                                  className="btn-secondary py-1 px-2.5 text-xs"
                                  style={{ width: "auto" }}
                                  title="Forward to Senior Tier"
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
            <div className="flex-1 min-w-0 flex flex-col p-4 sm:p-6 overflow-y-auto space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                    <span>💰</span>
                    <span>Civic Fund Requisitions & Maintenance Budgets</span>
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    Manage financial allocations for emergency infrastructure restoration and contractor tenders.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setFundComplaintId("");
                    setFundTitle("");
                    setShowFundModal(true);
                  }}
                  className="btn-primary flex items-center gap-1.5 py-2 px-4 text-xs font-bold"
                  style={{ width: "auto" }}
                >
                  <Plus size={16} />
                  <span>Raise New Fund Request</span>
                </button>
              </div>

              {/* Fund Requisition Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {funds.length === 0 ? (
                  <div className="col-span-full py-14 text-center glass-panel rounded-2xl" style={{ color: "var(--text-muted)" }}>
                    No active fund requisitions recorded for this jurisdiction.
                  </div>
                ) : (
                  funds.map((f, i) => (
                    <div key={i} className="officer-card p-5 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: "var(--glass-inner-bg)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
                            {f.fund_id}
                          </span>
                          <span className={`badge-status ${f.status === "Approved" ? "resolved" : "inprogress"}`}>
                            {f.status}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold leading-snug" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                          {f.title}
                        </h4>
                        
                        <div className="mt-3 p-3 rounded-xl glass-inner space-y-1 text-xs">
                          <div className="flex justify-between items-center">
                            <span style={{ color: "var(--text-secondary)" }}>Amount:</span>
                            <span className="text-base font-bold font-mono" style={{ color: "var(--accent-1)" }}>
                              ₹{Number(f.amount).toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span style={{ color: "var(--text-muted)" }}>Budget Head:</span>
                            <span className="font-medium truncate max-w-[170px]" style={{ color: "var(--text-primary)" }}>{f.budget_head}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span style={{ color: "var(--text-muted)" }}>Tender / Ref:</span>
                            <span className="font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>{f.contractor_tender_ref || "Direct Execution"}</span>
                          </div>
                        </div>

                        {f.justification && (
                          <p className="text-[11px] mt-2.5 line-clamp-2" style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>
                            {f.justification}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 flex gap-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                        <button
                          onClick={() => handleReviewFund(f.fund_id, "approved")}
                          className="btn-primary py-2 text-xs flex-1"
                        >
                          Approve Allocation
                        </button>
                        <button
                          onClick={() => handleReviewFund(f.fund_id, "rejected")}
                          className="btn-secondary py-2 text-xs px-3"
                          style={{ color: "var(--red)", borderColor: "var(--red-border)" }}
                        >
                          Audit Hold
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 4: OFFICIAL MAIL & MEMOS */}
          {/* ========================================================================= */}
          {activeSection === "memos" && (
            <div className="flex-1 min-w-0 flex flex-col p-4 sm:p-6 overflow-y-auto space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                    <span>✉️</span>
                    <span>Official Inter-Department Communications</span>
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    Dispatches, notices, and memos between Nagar Nigam, Jal Kal, PWD, and Police wings.
                  </p>
                </div>

                <button
                  onClick={() => setShowMemoModal(true)}
                  className="btn-primary flex items-center gap-1.5 py-2 px-4 text-xs font-bold"
                  style={{ width: "auto" }}
                >
                  <Mail size={16} />
                  <span>Dispatch New Memo</span>
                </button>
              </div>

              {/* Memos List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {memos.length === 0 ? (
                  <div className="col-span-full py-14 text-center glass-panel rounded-2xl" style={{ color: "var(--text-muted)" }}>
                    No official memos in your administrative mailbox.
                  </div>
                ) : (
                  memos.map((m, i) => (
                    <div key={i} className="officer-card p-5 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="officer-badge-pill">
                            {m.priority || "Urgent"}
                          </span>
                          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                            {new Date(m.created_at || Date.now()).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold leading-snug" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                          {m.subject}
                        </h4>

                        <div className="mt-2.5 p-3 rounded-xl glass-inner space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span style={{ color: "var(--text-muted)" }}>From:</span>
                            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{m.sender_name || "Administrative Head"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: "var(--text-muted)" }}>To:</span>
                            <span className="font-semibold" style={{ color: "var(--accent-1)" }}>{m.recipient_authority_name || "Jal Sansthan"}</span>
                          </div>
                        </div>

                        <p className="text-xs mt-3 line-clamp-3" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                          {m.body}
                        </p>
                      </div>

                      <div className="pt-3 flex justify-between items-center text-[11px] border-t" style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                        <span>Reference: {m.memo_id || "NIC-MEMO-2026"}</span>
                        <span className="font-semibold" style={{ color: "var(--green)" }}>Delivered ✓</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 5: SUBORDINATE OFFICERS & OVERSIGHT */}
          {/* ========================================================================= */}
          {activeSection === "subordinates" && (
            <div className="flex-1 min-w-0 flex flex-col p-4 sm:p-6 overflow-y-auto space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                    <span>👥</span>
                    <span>Subordinate Officers & Administrative Oversight</span>
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    Monitor personnel handles, issue directives, and reallocate ward jurisdictions.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      if (subordinates.length > 0) setTaskTargetSubordinate(subordinates[0].id);
                      setShowTaskModal(true);
                    }}
                    className="btn-primary py-2 px-3.5 text-xs font-bold"
                    style={{ width: "auto" }}
                  >
                    + Assign Directive
                  </button>
                  <button
                    onClick={() => {
                      if (subordinates.length > 0) setTransferOfficerId(subordinates[0].id);
                      setShowTransferModal(true);
                    }}
                    className="btn-secondary py-2 px-3.5 text-xs font-semibold"
                    style={{ width: "auto" }}
                  >
                    🔄 Transfer Officer
                  </button>
                </div>
              </div>

              {/* Subordinates Directory Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {subordinates.length === 0 ? (
                  <div className="col-span-full py-14 text-center glass-panel rounded-2xl" style={{ color: "var(--text-muted)" }}>
                    You are at the field frontline tier. There are no junior officers under your administrative command.
                  </div>
                ) : (
                  subordinates.map((sub, i) => (
                    <div key={i} className="officer-card p-5 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="officer-badge-pill">
                            {sub.badge}
                          </span>
                          <span className="text-xs font-mono font-bold" style={{ color: "var(--yellow)" }}>
                            ⭐ {sub.workload?.rating}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                          {sub.name}
                        </h4>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                          {sub.designation}
                        </p>

                        <div className="mt-3 p-3 rounded-xl glass-inner space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span style={{ color: "var(--text-muted)" }}>Assigned Ward:</span>
                            <span className="font-semibold truncate max-w-[150px]" style={{ color: "var(--accent-1)" }}>{sub.jurisdiction?.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: "var(--text-muted)" }}>Open Grievances:</span>
                            <span className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>{sub.workload?.open_complaints} open</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: "var(--text-muted)" }}>Resolution Rate:</span>
                            <span className="font-mono font-bold" style={{ color: "var(--green)" }}>{sub.workload?.resolution_rate}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t flex gap-2" style={{ borderColor: "var(--border-subtle)" }}>
                        <button
                          onClick={() => {
                            setTaskTargetSubordinate(sub.id);
                            setShowTaskModal(true);
                          }}
                          className="btn-secondary py-2 text-xs flex-1"
                        >
                          Send Task
                        </button>
                        <button
                          onClick={() => {
                            setTransferOfficerId(sub.id);
                            setShowTransferModal(true);
                          }}
                          className="btn-secondary py-2 text-xs flex-1"
                          style={{ borderColor: "rgba(var(--accent-1-rgb), 0.3)", color: "var(--accent-1)" }}
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
            <div className="flex-1 min-w-0 flex flex-col p-4 sm:p-6 overflow-y-auto space-y-5">
              <div className="pb-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                  <span>📊</span>
                  <span>Jurisdiction Performance & Area Rating Scorecard</span>
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  Performance benchmarks and citizen rating metrics for {officer.jurisdiction?.name}.
                </p>
              </div>

              {/* KPI Stat Cards (matches stats-row visual quality) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="officer-stat-kpi">
                  <span className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                    Civic Quality Index
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold font-mono" style={{ fontFamily: "var(--font-title)", color: "var(--accent-1)" }}>
                      {scorecard.civic_quality_score}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>/ 100</span>
                  </div>
                  <span className="text-[10px] font-bold mt-1 block" style={{ color: "var(--green)" }}>Grade A Governance</span>
                </div>

                <div className="officer-stat-kpi">
                  <span className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                    Citizen Satisfaction
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold font-mono" style={{ fontFamily: "var(--font-title)", color: "var(--yellow)" }}>
                      {scorecard.citizen_satisfaction_rating}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>★ out of 5</span>
                  </div>
                  <span className="text-[10px] mt-1 block" style={{ color: "var(--text-muted)" }}>Based on verified reviews</span>
                </div>

                <div className="officer-stat-kpi">
                  <span className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                    SLA On-Time Rate
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold font-mono" style={{ fontFamily: "var(--font-title)", color: "var(--green)" }}>
                      {scorecard.sla_compliance_rate}%
                    </span>
                  </div>
                  <span className="text-[10px] mt-1 block" style={{ color: "var(--green)" }}>Within 72hr deadline</span>
                </div>

                <div className="officer-stat-kpi">
                  <span className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                    Total Resolved
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold font-mono" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                      {scorecard.metrics?.resolved_complaints || 0}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>/ {scorecard.metrics?.total_complaints || 0}</span>
                  </div>
                  <span className="text-[10px] mt-1 block" style={{ color: "var(--text-secondary)" }}>Redressed Grievances</span>
                </div>
              </div>

              {/* Issue Category Breakdown */}
              <div className="officer-card p-5 shadow-xl">
                <h4 className="text-sm font-bold mb-4" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                  Civic Issues Distribution
                </h4>
                <div className="space-y-3.5">
                  {Object.entries(scorecard.category_breakdown || {}).map(([cat, cnt], idx) => {
                    const total = scorecard.metrics?.total_complaints || 1;
                    const pct = Math.round((cnt / total) * 100);
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                            <span>{ISSUE_ICONS[cat] || "📍"}</span>
                            <span>{cat}</span>
                          </span>
                          <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{cnt} cases ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--border-primary)" }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: "var(--accent-gradient)" }}
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
      {/* ALL MODALS (styled with user portal auth-modal-backdrop / glass aesthetic) */}
      {/* ========================================================================= */}
      {/* MODAL 1: TAKE ACTION ON COMPLAINT */}
      {showActionModal && selectedComplaint && (
        <div className="auth-modal-backdrop">
          <div className="officer-modal-box w-full max-w-lg p-6 shadow-2xl space-y-4 relative animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 pb-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                  <span>⚡</span>
                  <span>Take Administrative Action</span>
                </h3>
                <p className="text-xs font-mono mt-0.5" style={{ color: "var(--accent-1)" }}>
                  ID: {selectedComplaint.complaint_id} • {selectedComplaint.issue_type}
                </p>
              </div>
              <button
                onClick={() => setShowActionModal(false)}
                className="auth-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Action Type</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="glass-select"
                >
                  <option value="status_change">Progress Workflow Status</option>
                  <option value="schedule_inspection">Schedule Field Inspection</option>
                  <option value="reject">Reject with Official Justification</option>
                </select>
              </div>

              {actionType === "status_change" && (
                <div>
                  <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>New Status</label>
                  <select
                    value={actionStatus}
                    onChange={(e) => setActionStatus(e.target.value)}
                    className="glass-select"
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
                  <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Inspection Date</label>
                  <input
                    type="date"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    className="glass-input"
                  />
                </div>
              )}

              {actionType === "reject" ? (
                <div>
                  <label className="block font-semibold mb-1" style={{ color: "var(--red)" }}>Mandatory Rejection Reason</label>
                  <textarea
                    rows={3}
                    placeholder="Provide official reason why this complaint cannot be redressed..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="glass-input"
                    style={{ borderColor: "var(--red-border)" }}
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Action Remarks / Execution Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Enter official execution or inspection notes..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    className="glass-input"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t flex justify-end gap-2" style={{ borderColor: "var(--border-primary)" }}>
              <button
                onClick={() => setShowActionModal(false)}
                className="btn-secondary py-2 px-4 text-xs font-semibold"
                style={{ width: "auto" }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdvanceStatus}
                className="btn-primary py-2 px-5 text-xs font-bold"
                style={{ width: "auto" }}
              >
                Execute Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: FORWARD TO UPPER AUTHORITY */}
      {showForwardModal && selectedComplaint && (
        <div className="auth-modal-backdrop">
          <div className="officer-modal-box w-full max-w-lg p-6 shadow-2xl space-y-4 relative animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 pb-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                  <span>↗</span>
                  <span>Forward Complaint to Upper Hierarchy</span>
                </h3>
                <p className="text-xs font-mono mt-0.5" style={{ color: "var(--accent-1)" }}>
                  ID: {selectedComplaint.complaint_id} • {selectedComplaint.place_name}
                </p>
              </div>
              <button
                onClick={() => setShowForwardModal(false)}
                className="auth-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Target Administrative Tier</label>
                <select
                  value={forwardTargetLevel}
                  onChange={(e) => setForwardTargetLevel(e.target.value)}
                  className="glass-select"
                >
                  <option value="zone">Zonal Executive Office</option>
                  <option value="district">District Magistrate (DM) / Municipal Commissioner</option>
                  <option value="state">State Urban Development Directorate</option>
                  <option value="national">MoHUA Apex Central Command</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Urgency Level</label>
                <select
                  value={forwardUrgency}
                  onChange={(e) => setForwardUrgency(e.target.value)}
                  className="glass-select"
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical (Immediate Inter-Department Notice)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Escalation Justification</label>
                <textarea
                  rows={3}
                  placeholder="Explain why this requires senior intervention (e.g. utility jurisdiction conflict, budget shortage)..."
                  value={forwardJustification}
                  onChange={(e) => setForwardJustification(e.target.value)}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2" style={{ borderColor: "var(--border-primary)" }}>
              <button
                onClick={() => setShowForwardModal(false)}
                className="btn-secondary py-2 px-4 text-xs font-semibold"
                style={{ width: "auto" }}
              >
                Cancel
              </button>
              <button
                onClick={handleForwardUpper}
                className="btn-primary py-2 px-5 text-xs font-bold"
                style={{ width: "auto" }}
              >
                Submit Escalation Memo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RAISE FUND REQUEST */}
      {showFundModal && (
        <div className="auth-modal-backdrop">
          <div className="officer-modal-box w-full max-w-lg p-6 shadow-2xl space-y-4 relative animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 pb-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                  <span>💰</span>
                  <span>Raise Civic Maintenance Fund Requisition</span>
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  Budget will be audited and routed according to administrative threshold rules.
                </p>
              </div>
              <button
                onClick={() => setShowFundModal(false)}
                className="auth-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Requisition Title</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency Bitumen Resurfacing on Naubasta Arterial"
                  value={fundTitle}
                  onChange={(e) => setFundTitle(e.target.value)}
                  className="glass-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Amount (₹ INR)</label>
                  <input
                    type="number"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="glass-input font-mono font-bold"
                    style={{ color: "var(--accent-1)" }}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Urgency</label>
                  <select
                    value={fundUrgency}
                    onChange={(e) => setFundUrgency(e.target.value)}
                    className="glass-select"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Budget Head</label>
                <select
                  value={fundBudgetHead}
                  onChange={(e) => setFundBudgetHead(e.target.value)}
                  className="glass-select"
                >
                  <option value="Emergency Road & Drainage Restoration">Emergency Road & Drainage Restoration</option>
                  <option value="Solid Waste & Compactor Replacement">Solid Waste & Compactor Replacement</option>
                  <option value="Underground Sewer Conduit Overhaul">Underground Sewer Conduit Overhaul</option>
                  <option value="Smart City LED Lighting & Feeder Repair">Smart City LED Lighting & Feeder Repair</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Technical Justification</label>
                <textarea
                  rows={2}
                  placeholder="Technical justification and engineer recommendation..."
                  value={fundJustification}
                  onChange={(e) => setFundJustification(e.target.value)}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2" style={{ borderColor: "var(--border-primary)" }}>
              <button
                onClick={() => setShowFundModal(false)}
                className="btn-secondary py-2 px-4 text-xs font-semibold"
                style={{ width: "auto" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFund}
                className="btn-primary py-2 px-5 text-xs font-bold"
                style={{ width: "auto" }}
              >
                Submit Requisition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DISPATCH OFFICIAL MEMO */}
      {showMemoModal && (
        <div className="auth-modal-backdrop">
          <div className="officer-modal-box w-full max-w-lg p-6 shadow-2xl space-y-4 relative animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 pb-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                  <span>✉️</span>
                  <span>Dispatch Inter-Department Official Memo</span>
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  Legally logged under the UP Public Services Guarantee Framework.
                </p>
              </div>
              <button
                onClick={() => setShowMemoModal(false)}
                className="auth-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Recipient Authority</label>
                <select
                  value={memoRecipientId}
                  onChange={(e) => setMemoRecipientId(e.target.value)}
                  className="glass-select"
                >
                  {AUTHORITIES_LIST.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Joint Site Inspection: Underground pipeline leakage"
                  value={memoSubject}
                  onChange={(e) => setMemoSubject(e.target.value)}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Priority</label>
                <select
                  value={memoPriority}
                  onChange={(e) => setMemoPriority(e.target.value)}
                  className="glass-select"
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent (48 Hour Response)</option>
                  <option value="Immediate">Immediate / Emergency Directive</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Official Memo Content</label>
                <textarea
                  rows={4}
                  placeholder="Enter formal notice text and directives..."
                  value={memoBody}
                  onChange={(e) => setMemoBody(e.target.value)}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2" style={{ borderColor: "var(--border-primary)" }}>
              <button
                onClick={() => setShowMemoModal(false)}
                className="btn-secondary py-2 px-4 text-xs font-semibold"
                style={{ width: "auto" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendMemo}
                className="btn-primary py-2 px-5 text-xs font-bold"
                style={{ width: "auto" }}
              >
                Dispatch Memo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ASSIGN DIRECT TASK TO SUBORDINATE */}
      {showTaskModal && (
        <div className="auth-modal-backdrop">
          <div className="officer-modal-box w-full max-w-lg p-6 shadow-2xl space-y-4 relative animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 pb-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                  <span>⚡</span>
                  <span>Assign Directive to Subordinate</span>
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  Direct task delegated with administrative accountability tracking.
                </p>
              </div>
              <button
                onClick={() => setShowTaskModal(false)}
                className="auth-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Assignee (Junior Officer)</label>
                <select
                  value={taskTargetSubordinate}
                  onChange={(e) => setTaskTargetSubordinate(e.target.value)}
                  className="glass-select"
                >
                  {subordinates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.designation} - {s.jurisdiction?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Directive Title</label>
                <input
                  type="text"
                  placeholder="e.g. Execute urgent road recarpeting by 5 PM"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Instructions & Checklist</label>
                <textarea
                  rows={3}
                  placeholder="Specific instructions, inspection checklist, and deadlines..."
                  value={taskInstructions}
                  onChange={(e) => setTaskInstructions(e.target.value)}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2" style={{ borderColor: "var(--border-primary)" }}>
              <button
                onClick={() => setShowTaskModal(false)}
                className="btn-secondary py-2 px-4 text-xs font-semibold"
                style={{ width: "auto" }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignTask}
                className="btn-primary py-2 px-5 text-xs font-bold"
                style={{ width: "auto" }}
              >
                Issue Directive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: TRANSFER JUNIOR OFFICER */}
      {showTransferModal && (
        <div className="auth-modal-backdrop">
          <div className="officer-modal-box w-full max-w-lg p-6 shadow-2xl space-y-4 relative animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 pb-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                  <span>🔄</span>
                  <span>Issue Officer Transfer Order</span>
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  Official reallocation of municipal personnel within jurisdiction.
                </p>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="auth-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Select Subordinate Officer</label>
                <select
                  value={transferOfficerId}
                  onChange={(e) => setTransferOfficerId(e.target.value)}
                  className="glass-select"
                >
                  {subordinates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Current: {s.jurisdiction?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>New Assigned Ward / Jurisdiction</label>
                <input
                  type="text"
                  placeholder="e.g. Ward 45 (Govind Nagar)"
                  value={transferWardName}
                  onChange={(e) => setTransferWardName(e.target.value)}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Transfer Justification</label>
                <textarea
                  rows={2}
                  placeholder="Administrative reason for transfer..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2" style={{ borderColor: "var(--border-primary)" }}>
              <button
                onClick={() => setShowTransferModal(false)}
                className="btn-secondary py-2 px-4 text-xs font-semibold"
                style={{ width: "auto" }}
              >
                Cancel
              </button>
              <button
                onClick={handleTransferOfficer}
                className="btn-primary py-2 px-5 text-xs font-bold"
                style={{ width: "auto" }}
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
