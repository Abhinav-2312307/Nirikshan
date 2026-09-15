"use client";

import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { ChevronLeft, ChevronRight, Map, AlertTriangle, Layers, Settings, LogOut, Search, Loader2, CheckCircle2, XCircle, Sun, Moon } from "lucide-react";

// Mapping icons for different categories
const ISSUE_ICONS = {
  Pothole: "🕳️",
  Water: "🚰",
  Streetlight: "💡",
  Sewer: "🚿",
  Garbage: "🗑️",
  Safety: "⚠️",
  Encroachment: "🚧"
};

const PLACE_ICONS = {
  road: "🛣️",
  park: "🌳",
  home: "🏠",
  shop: "🏬",
  "public-place": "📍",
  location: "📌"
};

function getPlaceStyle(feature, styleState = "base") {
  const type = feature.properties.type;
  if (styleState === "selected") {
    if (type === "road") return { color: "#ec4899", weight: 9, opacity: 1.0, lineCap: "round" };
    if (type === "park") return { color: "#ec4899", weight: 3, fillColor: "#f472b6", fillOpacity: 0.55 };
    return { color: "#ec4899", weight: 4, fillColor: "#f472b6", fillOpacity: 0.4 };
  }
  if (styleState === "hover") {
    if (type === "road") return { color: "#c084fc", weight: 8, opacity: 1.0, lineCap: "round" };
    if (type === "park") return { color: "#a78bfa", weight: 2.5, fillColor: "#c084fc", fillOpacity: 0.45 };
    return { color: "#cbd5e1", weight: 3.5, fillColor: "#e2e8f0", fillOpacity: 0.35 };
  }
  // Default base style
  if (type === "road") return { color: "#818cf8", weight: 5, opacity: 0.8, lineCap: "round" };
  if (type === "park") return { color: "#10b981", weight: 1.5, fillColor: "#34d399", fillOpacity: 0.35 };
  return { color: "#94a3b8", weight: 2, fillColor: "#cbd5e1", fillOpacity: 0.2 };
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("map"); // "map" | "citizen" | "governance"
  const [activeMode, setActiveMode] = useState("explore"); // "explore" | "aqi" | "heatmap"
  const [userTrustScore, setUserTrustScore] = useState(50);
  const [userVerifiedOtp, setUserVerifiedOtp] = useState(false);
  const [userVerifiedAadhaar, setUserVerifiedAadhaar] = useState(false);
  const [userId, setUserId] = useState("demo-citizen-101");
  const [citizenUser, setCitizenUser] = useState(null);
  const [showCitizenModal, setShowCitizenModal] = useState(false);
  const [citizenEmail, setCitizenEmail] = useState("rahul.sharma@example.com");
  const [citizenPassword, setCitizenPassword] = useState("citizen123");
  const [citizenAuthError, setCitizenAuthError] = useState("");
  const [authorityRole, setAuthorityRole] = useState("citizen");
  const [viewModerationQueue, setViewModerationQueue] = useState(false);
  const [mapTheme, setMapTheme] = useState("dark"); // "dark" | "street"
  const [isLocating, setIsLocating] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [theme, setTheme] = useState("dark"); // "dark" | "light"

  const showToast = (message, type = "success") => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Hydrate theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("nirikshan_theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  // Sync theme to DOM and localStorage
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("nirikshan_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

  useEffect(() => {
    const saved = localStorage.getItem("nirikshan_citizen_user");
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setCitizenUser(u);
        setUserId(u.user_id || "demo-citizen-101");
        setUserTrustScore(u.trust_score || 85);
      } catch (e) {}
    }
  }, []);

  const handleCitizenAuth = async (overrideEmail, overridePass) => {
    setCitizenAuthError("");
    const targetEmail = overrideEmail || citizenEmail;
    const targetPass = overridePass || citizenPassword;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPass, role: "citizen" })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Login failed");
      localStorage.setItem("nirikshan_citizen_user", JSON.stringify(data.user));
      localStorage.setItem("nirikshan_citizen_token", data.token);
      setCitizenUser(data.user);
      setUserId(data.user.user_id);
      setUserTrustScore(data.user.trust_score || 85);
      setShowCitizenModal(false);
    } catch (err) {
      setCitizenAuthError(err.message);
    }
  };

  const handleCitizenLogout = () => {
    localStorage.removeItem("nirikshan_citizen_user");
    localStorage.removeItem("nirikshan_citizen_token");
    setCitizenUser(null);
    setUserId("demo-citizen-101");
    setUserTrustScore(50);
  };

  // Keep refs of active mode and active tab to prevent stale closures in Leaflet events
  const activeTabRef = useRef(activeTab);
  const activeModeRef = useRef(activeMode);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  // Places and metrics
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [selectedLatlng, setSelectedLatlng] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [placeComplaints, setPlaceComplaints] = useState([]);
  
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  // Stats and lists
  const [summary, setSummary] = useState({ total: 0, pending: 0, resolved: 0, highPriority: 0 });
  const [myReports, setMyReports] = useState([]);
  const [officerComplaints, setOfficerComplaints] = useState([]);
  const [authorities, setAuthorities] = useState([]);
  const [wardRankings, setWardRankings] = useState([]);
  
  // Simulated photo upload
  const [uploadedImage, setUploadedImage] = useState(null);

  const [hoveredArea, setHoveredArea] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Map refs
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const aqiLayerRef = useRef(null);
  const placesLayerRef = useRef(null);
  const clusterLayerRef = useRef(null);
  const heatLayerRef = useRef(null);
  const selectionMarkerRef = useRef(null);
  const selectedLayerRef = useRef(null);
  const selectedAqiLayerRef = useRef(null);
  const selectedAreaIdRef = useRef(null);
  const userLocationMarkerRef = useRef(null);
  const orientationListenerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const labelLayerRef = useRef(null);
  const fetchedAreasCache = useRef({});
  const currentAqiLevelRef = useRef(null);
  const placesCacheRef = useRef([]);
  const zoomDebounceRef = useRef(null);
  const [bgSyncStatus, setBgSyncStatus] = useState("ready"); // "ready" | "syncing"

  useEffect(() => {
    // Attach L to window so leaflet plugins can find it
    if (typeof window !== "undefined") {
      window.L = L;
      require("leaflet.markercluster");
      require("leaflet.heat");
    }

    // Fix Leaflet marker icon paths
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png"
    });

    if (!mapInstance.current && mapRef.current) {
      const map = L.map(mapRef.current, {
        zoomControl: true,
        minZoom: 3,
        maxZoom: 18,
        preferCanvas: true // Hardware-accelerated canvas rendering for vector polygons
      }).setView([26.4069, 80.3315], 14);

      const tiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
        maxNativeZoom: 16,
        maxZoom: 20
      }).addTo(map);
      tileLayerRef.current = tiles;

      // Dark Gray Reference Overlay Layer (road names, cities, landmarks)
      const labelTiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
        maxNativeZoom: 16,
        maxZoom: 20,
        pane: "shadowPane"
      }).addTo(map);
      labelLayerRef.current = labelTiles;

      mapInstance.current = map;

      const markerCluster = L.markerClusterGroup();
      map.addLayer(markerCluster);
      clusterLayerRef.current = markerCluster;

      map.on("zoomend", handleZoomEnd);
      map.on("click", async (e) => {
        setSelectedLatlng(e.latlng);
        await resolveAndRenderPlace(e.latlng.lat, e.latlng.lng);
      });

      // Trigger initial load: dynamically pick level matching zoom 14 (macro wards ~120KB vs 2MB)
      refreshAqiLayer();
      startBackgroundStreaming();
      loadPlacesLayer();
      refreshMetrics();
      refreshComplaints();

      // Use ResizeObserver to ensure Leaflet recalculates size when parent container size is resolved (e.g. CSS Grid resolution)
      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
        requestAnimationFrame(() => {
          map.invalidateSize();
        });
      });
      if (mapRef.current) {
        resizeObserver.observe(mapRef.current);
      }
      map._resizeObserver = resizeObserver;

      // Force recalculation at multiple delay intervals once Leaflet is ready to handle Next.js hydration styling delays
      map.whenReady(() => {
        [50, 150, 300, 600, 1000].forEach(delay => {
          setTimeout(() => {
            if (mapInstance.current) {
              mapInstance.current.invalidateSize();
            }
          }, delay);
        });
      });
    }

    return () => {
      if (zoomDebounceRef.current) {
        clearTimeout(zoomDebounceRef.current);
      }
      if (mapInstance.current) {
        if (mapInstance.current._resizeObserver) {
          mapInstance.current._resizeObserver.disconnect();
        }
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      if (orientationListenerRef.current) {
        window.removeEventListener("deviceorientation", orientationListenerRef.current);
      }
    };
  }, []);

  // Update tile layer theme dynamically when mapTheme changes
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current);
    if (labelLayerRef.current && map.hasLayer(labelLayerRef.current)) {
      map.removeLayer(labelLayerRef.current);
      labelLayerRef.current = null;
    }

    if (mapTheme === "street") {
      // High-resolution OpenStreetMap with every local building and street detail
      const newTiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxNativeZoom: 19,
        maxZoom: 20
      }).addTo(map);
      tileLayerRef.current = newTiles;
    } else if (mapTheme === "satellite") {
      // High-resolution photorealistic ESRI World Satellite Imagery
      const satTiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        maxNativeZoom: 18,
        maxZoom: 20
      }).addTo(map);
      tileLayerRef.current = satTiles;

      const satLabels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
        maxNativeZoom: 18,
        maxZoom: 20,
        pane: "shadowPane"
      }).addTo(map);
      labelLayerRef.current = satLabels;
    } else {
      // Sleek Dark Matter + High-detail Reference Labels
      const darkTiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
        maxNativeZoom: 16,
        maxZoom: 20
      }).addTo(map);
      tileLayerRef.current = darkTiles;

      const darkLabels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
        maxNativeZoom: 16,
        maxZoom: 20,
        pane: "shadowPane"
      }).addTo(map);
      labelLayerRef.current = darkLabels;
    }
  }, [mapTheme]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ignore if typing in text fields
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.isContentEditable
      )) {
        return;
      }

      const map = mapInstance.current;
      if (!map) return;

      const dx = 80; // Panning pixel step
      let handled = false;

      switch (e.key) {
        // Pan controls
        case "w":
        case "W":
        case "ArrowUp":
          map.panBy([0, -dx]);
          handled = true;
          break;
        case "s":
        case "S":
        case "ArrowDown":
          map.panBy([0, dx]);
          handled = true;
          break;
        case "a":
        case "A":
        case "ArrowLeft":
          map.panBy([-dx, 0]);
          handled = true;
          break;
        case "d":
        case "D":
        case "ArrowRight":
          map.panBy([dx, 0]);
          handled = true;
          break;

        // Zoom controls
        case "e":
        case "E":
        case "=":
        case "+":
          map.zoomIn();
          handled = true;
          break;
        case "q":
        case "Q":
        case "-":
          map.zoomOut();
          handled = true;
          break;

        // Reset view to Naubasta, Kanpur
        case "r":
        case "R":
          map.setView([26.4069, 80.3315], 14);
          handled = true;
          break;

        // Quick fly to Lucknow Wards
        case "l":
        case "L":
          map.flyTo([26.8467, 80.9462], 13);
          handled = true;
          break;

        // Quick fly to Kanpur Wards
        case "k":
        case "K":
          map.flyTo([26.4499, 80.3319], 13);
          handled = true;
          break;

        // Map mode switches
        case "1":
          setActiveMode("explore");
          handled = true;
          break;
        case "2":
          setActiveMode("aqi");
          handled = true;
          break;
        case "3":
          setActiveMode("heatmap");
          handled = true;
          break;

        // Theme toggle
        case "t":
        case "T":
          setMapTheme(prev => prev === "dark" ? "street" : "dark");
          handled = true;
          break;

        // Locate Me (Center on User)
        case "c":
        case "C":
        case "u":
        case "U":
          handleLocateMe();
          handled = true;
          break;

        default:
          break;
      }

      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [mapTheme, activeMode]);

  // Update map when mode changes
  useEffect(() => {
    if (mapInstance.current) {
      updateMapVisuals();
      requestAnimationFrame(() => {
        if (mapInstance.current) mapInstance.current.invalidateSize();
      });
    }
  }, [activeMode]);

  // Update map when tab changes
  useEffect(() => {
    if (mapInstance.current) {
      mapInstance.current.invalidateSize();
      requestAnimationFrame(() => {
        if (mapInstance.current) mapInstance.current.invalidateSize();
      });
      setTimeout(() => {
        if (mapInstance.current) mapInstance.current.invalidateSize();
      }, 100);
    }
  }, [activeTab]);

  // Load lists on tab switches
  useEffect(() => {
    if (activeTab === "citizen") {
      loadMyReports();
    } else if (activeTab === "governance") {
      loadGovernanceData();
    }
  }, [activeTab, authorityRole, viewModerationQueue]);

  const api = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  };

  const refreshMetrics = async () => {
    const summaryData = await api("/api/analytics/summary");
    setSummary(summaryData);
  };

  const loadMyReports = async () => {
    const reports = await api("/api/complaints?include_moderation=true");
    setMyReports(reports);
  };

  const loadGovernanceData = async () => {
    const authList = await api("/api/complaints/authorities");
    setAuthorities(authList);

    const wards = await api("/api/areas?level=macro");
    const sortedWards = (wards.features || [])
      .map(w => w.properties)
      .sort((a, b) => b.area_score - a.area_score);
    setWardRankings(sortedWards);

    let officerUrl = "/api/complaints?include_moderation=true";
    if (authorityRole !== "citizen") {
      officerUrl = `/api/complaints?authority_id=${authorityRole}&include_moderation=${viewModerationQueue}`;
    }
    const officerList = await api(officerUrl);
    setOfficerComplaints(officerList);
  };

  const loadPlacesLayer = async () => {
    // Disable loading mock places vector layer to keep map clean of artificial polylines/polygons
    return;

    if (placesLayerRef.current && map.hasLayer(placesLayerRef.current)) {
      map.removeLayer(placesLayerRef.current);
    }

    const layer = L.geoJSON(data, {
      filter: (feature) => {
        // Exclude static point landmarks (homes, offices, shops, etc.) for now
        return feature.geometry && feature.geometry.type !== "Point";
      },
      style: (feature) => getPlaceStyle(feature, "base"),
      pointToLayer: (feature, latlng) => {
        const icon = L.divIcon({
          className: "",
          html: `<div class="place-pin">${PLACE_ICONS[feature.properties.type] || "📍"}</div>`,
          iconSize: [26, 26]
        });
        return L.marker(latlng, { icon });
      },
      onEachFeature: (feature, layer) => {
        layer.on("mouseover", (e) => {
          if (selectedLayerRef.current === layer) return;
          if (typeof layer.setStyle === "function") {
            layer.setStyle(getPlaceStyle(feature, "hover"));
          }
        });
        layer.on("mouseout", (e) => {
          if (selectedLayerRef.current === layer) return;
          if (typeof layer.setStyle === "function") {
            layer.setStyle(getPlaceStyle(feature, "base"));
          }
        });
        layer.on("click", async (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedLatlng(e.latlng);
          
          if (selectedLayerRef.current && selectedLayerRef.current !== layer) {
            const oldFeature = selectedLayerRef.current.feature;
            if (typeof selectedLayerRef.current.setStyle === "function") {
              selectedLayerRef.current.setStyle(getPlaceStyle(oldFeature, "base"));
            }
          }
          
          selectedLayerRef.current = layer;
          if (typeof layer.setStyle === "function") {
            layer.setStyle(getPlaceStyle(feature, "selected"));
          }
          
          await resolveAndRenderPlace(e.latlng.lat, e.latlng.lng);
        });
        layer.bindTooltip(`${feature.properties.name} (${feature.properties.type})`);
      }
    });

    placesLayerRef.current = layer;
    if (activeMode === "explore") {
      layer.addTo(map);
    }
  };

  const startBackgroundStreaming = () => {
    if (typeof window === "undefined") return;

    // Progressive queue: immediate neighbors first, then places, then macro/states
    const queue = [
      { type: "area", level: "micro" },
      { type: "area", level: "kanpur-subdistricts" },
      { type: "places", limit: 100 },
      { type: "area", level: "submicro" },
      { type: "area", level: "up-districts" },
      { type: "area", level: "india-states" }
    ];

    setBgSyncStatus("syncing");

    const processNext = () => {
      if (!queue.length) {
        setBgSyncStatus("ready");
        return;
      }

      const executeTask = async () => {
        const item = queue.shift();
        try {
          if (item.type === "area") {
            if (!fetchedAreasCache.current[item.level]) {
              const fetchPromise = api(`/api/areas?level=${item.level}`);
              fetchedAreasCache.current[item.level] = fetchPromise;
              const res = await fetchPromise;
              fetchedAreasCache.current[item.level] = res;
            }
          } else if (item.type === "places") {
            if (!placesCacheRef.current || placesCacheRef.current.length === 0) {
              const res = await api(`/api/places?limit=${item.limit}`);
              placesCacheRef.current = res.features || [];
            }
          }
        } catch (err) {
          console.warn("Background streaming item non-critical error:", err);
        }

        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(() => processNext(), { timeout: 2500 });
        } else {
          setTimeout(processNext, 250);
        }
      };

      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => executeTask(), { timeout: 2500 });
      } else {
        setTimeout(executeTask, 250);
      }
    };

    // Defer background prefetching slightly to let initial paint and map tiles load with zero contention
    setTimeout(processNext, 800);
  };

  const refreshAqiLayer = async (level = null, force = false) => {
    const map = mapInstance.current;
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
      const fetchPromise = api(`/api/areas?level=${level}`);
      fetchedAreasCache.current[level] = fetchPromise;
      data = await fetchPromise;
      fetchedAreasCache.current[level] = data;
    }
    const activeMap = mapInstance.current;
    if (!activeMap) return;

    // Capture the old layer to fade it out
    const oldLayer = aqiLayerRef.current;
    if (oldLayer && activeMap.hasLayer(oldLayer)) {
      oldLayer.eachLayer((childLayer) => {
        if (typeof childLayer.getElement === "function") {
          const el = childLayer.getElement();
          if (el) el.classList.remove("visible");
        }
      });
      setTimeout(() => {
        if (activeMap.hasLayer(oldLayer)) {
          activeMap.removeLayer(oldLayer);
        }
      }, 400); // Remove from map after fade-out transition completes
    }

    // Clear temporary visual ref; it will be re-assigned in onEachFeature if present in the new set
    selectedAqiLayerRef.current = null;

    const isHeatmap = activeModeRef.current === "heatmap";

    const layer = L.geoJSON(data, {
      style: (feature) => {
        const isSelected = selectedAreaIdRef.current === feature.properties.area_id;
        return {
          fillColor: scoreToColor(feature.properties.area_score),
          color: isSelected ? "#ec4899" : (isHeatmap ? "transparent" : "#ffffff"),
          weight: isSelected ? 3.5 : (isHeatmap ? 0 : 1.5),
          fillOpacity: isHeatmap ? 0.75 : 0.45,
          className: `aqi-region ${isHeatmap ? "aqi-heatmap-blended" : ""}`
        };
      },
      onEachFeature: (feature, childLayer) => {
        const isSelected = selectedAreaIdRef.current === feature.properties.area_id;
        if (isSelected) {
          selectedAqiLayerRef.current = childLayer;
        }

        const areaName = feature.properties.name || "Administrative Area";
        const isMacroLevel = ["india-states", "up-districts", "kanpur-subdistricts", "macro"].includes(level);

        // Apply hover tooltip for area details
        childLayer.bindTooltip(`
          <div class="area-tooltip-content">
            <div class="area-tooltip-title">${areaName}</div>
            <div class="area-tooltip-badge" style="background:${scoreToColor(feature.properties.area_score)}22; color:${scoreToColor(feature.properties.area_score)}; border-color:${scoreToColor(feature.properties.area_score)}">
              AQI Score: ${feature.properties.area_score} • ${feature.properties.area_status || "Standard"}
            </div>
          </div>
        `, {
          sticky: true,
          className: "glass-area-tooltip"
        });

        childLayer.on("mouseover", (e) => {
          // Update live preview HUD on hover
          setHoveredArea({
            name: areaName,
            level: level,
            score: feature.properties.area_score,
            status: feature.properties.area_status || "Standard",
            authority: feature.properties.authority,
            city: feature.properties.city
          });

          if (isHeatmap) return;
          if (selectedAqiLayerRef.current === childLayer) return;
          if (typeof childLayer.setStyle === "function") {
            childLayer.setStyle({
              color: "#c084fc", // Lavender hover
              weight: 2.5
            });
          }
        });

        childLayer.on("mouseout", (e) => {
          setHoveredArea(null);
          if (isHeatmap) return;
          if (selectedAqiLayerRef.current === childLayer) return;
          if (typeof childLayer.setStyle === "function") {
            childLayer.setStyle({
              color: "#ffffff", // Revert to white
              weight: 1.5
            });
          }
        });

        childLayer.on("click", async (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedLatlng(e.latlng);

          // Clear previous selection highlight
          if (selectedAqiLayerRef.current && selectedAqiLayerRef.current !== childLayer) {
            const prev = selectedAqiLayerRef.current;
            if (typeof prev.setStyle === "function") {
              prev.setStyle({
                color: "#ffffff",
                weight: 1.5
              });
            }
          }

          // Apply selected boundary style
          selectedAreaIdRef.current = feature.properties.area_id;
          selectedAqiLayerRef.current = childLayer;
          if (typeof childLayer.setStyle === "function") {
            childLayer.setStyle({
              color: "#ec4899", // Hot pink boundary outline
              weight: 3.5
            });
          }

          // Drop a selection pin marker at the exact coordinate clicked
          if (selectionMarkerRef.current) {
            activeMap.removeLayer(selectionMarkerRef.current);
          }
          const tempIcon = L.divIcon({
            className: "",
            html: `<div class="place-pin" style="border-color: #ec4899; box-shadow: 0 0 12px #ec4899;">📍</div>`,
            iconSize: [26, 26]
          });
          selectionMarkerRef.current = L.marker(e.latlng, { icon: tempIcon }).addTo(activeMap);

          // Select the administrative area itself as the place card entity so user can rate/review it
          const areaId = feature.properties.area_id;
          try {
            const [reviewsList, complaintsList] = await Promise.all([
              api(`/api/places/${encodeURIComponent(areaId)}/reviews`),
              api(`/api/complaints?place_id=${encodeURIComponent(areaId)}&include_moderation=true`)
            ]);

            setReviews(reviewsList);
            setPlaceComplaints(complaintsList);

            setSelectedPlace({
              place: {
                type: "Feature",
                properties: {
                  place_id: areaId,
                  name: feature.properties.name,
                  type: feature.properties.level || "area",
                  area_id: areaId,
                  address: `${feature.properties.city || "Local Jurisdiction"}, Uttar Pradesh`,
                  is_virtual: false
                },
                geometry: feature.geometry
              },
              metrics: {
                avg_rating: reviewsList.length ? Number((reviewsList.reduce((s, r) => s + r.rating, 0) / reviewsList.length).toFixed(1)) : 0,
                review_count: reviewsList.length,
                complaint_count: complaintsList.length,
                pending_complaints: complaintsList.filter(c => !["Resolved", "Closed"].includes(c.status)).length
              },
              area: {
                area_id: areaId,
                name: feature.properties.name,
                authority: feature.properties.authority || "Local Authority",
                city: feature.properties.city || "Kanpur"
              }
            });
          } catch (err) {
            console.error("Error loading metrics for clicked area:", err);
          }
        });
      }
    });

    aqiLayerRef.current = layer;

    if (activeModeRef.current === "aqi") {
      layer.addTo(activeMap);
      // Wait for layout/paint and trigger smooth fade-in
      requestAnimationFrame(() => {
        setTimeout(() => {
          layer.eachLayer((childLayer) => {
            if (typeof childLayer.getElement === "function") {
              const el = childLayer.getElement();
              if (el) el.classList.add("visible");
            }
          });
        }, 50);
      });
    }
  };

  const requestOrientationPermission = () => {
    if (typeof window === "undefined") return;

    const handleOrientation = (e) => {
      let headingVal = null;
      if (e.webkitCompassHeading !== undefined) {
        headingVal = e.webkitCompassHeading;
      } else if (e.alpha !== undefined) {
        headingVal = 360 - e.alpha;
      }

      if (headingVal !== null) {
        const roundedHeading = Math.round(headingVal);
        const el = document.querySelector(".user-location-heading");
        if (el) {
          el.style.transform = `rotate(${roundedHeading}deg)`;
          el.style.display = "block";
        }
      }
    };

    orientationListenerRef.current = handleOrientation;

    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      DeviceOrientationEvent.requestPermission()
        .then((response) => {
          if (response === "granted") {
            window.addEventListener("deviceorientation", handleOrientation);
          }
        })
        .catch(console.error);
    } else {
      window.addEventListener("deviceorientation", handleOrientation);
    }
  };

  const updateUserLocationMarker = (lat, lng) => {
    const map = mapInstance.current;
    if (!map) return;

    if (userLocationMarkerRef.current) {
      map.removeLayer(userLocationMarkerRef.current);
    }

    const icon = L.divIcon({
      className: "",
      html: `
        <div class="user-location-container">
          <div class="user-location-heading"></div>
          <div class="user-location-pulsing-dot"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    userLocationMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map);
  };
  const handleClosePlace = () => {
    setSelectedPlace(null);
    setSelectedLatlng(null);
    if (selectedLayerRef.current) {
      if (typeof selectedLayerRef.current.setStyle === "function") {
        selectedLayerRef.current.setStyle(getPlaceStyle(selectedLayerRef.current.feature, "base"));
      }
      selectedLayerRef.current = null;
    }
    if (selectedAqiLayerRef.current) {
      if (typeof selectedAqiLayerRef.current.setStyle === "function") {
        selectedAqiLayerRef.current.setStyle({ color: "#ffffff", weight: 1.5 });
      }
      selectedAqiLayerRef.current = null;
    }
    selectedAreaIdRef.current = null;
    if (selectionMarkerRef.current && mapInstance.current) {
      mapInstance.current.removeLayer(selectionMarkerRef.current);
      selectionMarkerRef.current = null;
    }
  };

  const handleLocateMe = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const map = mapInstance.current;
        if (!map) {
          setIsLocating(false);
          return;
        }

        map.flyTo([latitude, longitude], 15, { duration: 1.2 });
        updateUserLocationMarker(latitude, longitude);
        setIsLocating(false);

        // Attempt to request and hook orientation pointer
        requestOrientationPermission();
      },
      (error) => {
        setIsLocating(false);
        alert(`Could not retrieve location: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleZoomEnd = () => {
    if (activeModeRef.current !== "aqi") return;
    if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
    zoomDebounceRef.current = setTimeout(async () => {
      await refreshAqiLayer();
    }, 150);
  };

  const refreshComplaints = async () => {
    const list = await api("/api/complaints?include_moderation=true");
    const map = mapInstance.current;
    const markerCluster = clusterLayerRef.current;
    if (!map || !markerCluster) return;

    if (activeMode === "explore") {
      markerCluster.clearLayers();
      list.forEach(c => {
        if (c.status === "Moderation") return;

        const isEscalatedStr = c.escalated ? ` | <span style="color: #f43f5e; font-weight:700;">ESCALATED (No update > 30d)</span>` : "";
        const isDisputedStr = c.verification_status === "Disputed" ? ` | <span style="color: #f43f5e; font-weight:700;">DISPUTED RESOLUTION</span>` : "";
        let duplicateAlert = "";
        if (c.duplicate_of) {
          duplicateAlert = `<br><span style="color: #fbbf24; font-size: 0.78rem; font-weight:600;">⚠️ Linked as duplicate of complaint #${c.duplicate_of.slice(0, 8)}</span>`;
        }

        let routeText = `Routed Authority: ${c.authority} (${c.department})`;
        if (c.disputed_jurisdiction) {
          routeText = `<strong style="color:#60a5fa;">Overlapping Jurisdiction Assigned:</strong><ul style="margin-left: 14px; margin-top: 3px;">` + 
                      c.assigned_authorities.map(a => `<li>${a.name} (${a.department})</li>`).join("") + `</ul>`;
        }

        const icon = L.divIcon({
          className: "",
          html: `<div class="place-pin" style="border-color: ${c.status === 'Resolved' ? '#10b981' : '#f59e0b'}">${ISSUE_ICONS[c.issue_type] || "📍"}</div>`,
          iconSize: [26, 26]
        });

        const marker = L.marker([c.latitude, c.longitude], { icon });
        marker.bindPopup(`
          <div style="font-family: sans-serif; color: #1e293b; max-width: 250px;">
            <h4 style="margin: 0; font-size: 0.95rem; display: flex; justify-content: space-between; align-items: center;">
              <span>${ISSUE_ICONS[c.issue_type] || "📍"} ${c.issue_type}</span>
              <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 99px; background: #e2e8f0; color: #475569;">${c.status}</span>
            </h4>
            <p style="margin: 6px 0; font-size: 0.8rem;">${c.description}</p>
            <div style="font-size: 0.74rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px;">
              ${routeText}
              ${duplicateAlert}
              <br><span style="font-size: 0.68rem; color: #94a3b8; display:block; margin-top:4px;">ID: ${c.complaint_id}</span>
            </div>
          </div>
        `);
        markerCluster.addLayer(marker);
      });
    } else if (activeMode === "heatmap") {
      if (!heatLayerRef.current) {
        heatLayerRef.current = L.heatLayer([], { radius: 26, blur: 22, maxZoom: 18 }).addTo(map);
      } else if (!map.hasLayer(heatLayerRef.current)) {
        heatLayerRef.current.addTo(map);
      }
      const heatPoints = list
        .filter(c => c.status !== "Closed" && c.status !== "Moderation")
        .map(c => [c.latitude, c.longitude, c.severity / 3]);
      heatLayerRef.current.setLatLngs(heatPoints);
    }
  };

  const updateMapVisuals = () => {
    const map = mapInstance.current;
    const markerCluster = clusterLayerRef.current;
    if (!map) return;

    if (aqiLayerRef.current) map.removeLayer(aqiLayerRef.current);
    if (heatLayerRef.current && map.hasLayer(heatLayerRef.current)) {
      map.removeLayer(heatLayerRef.current);
    }
    if (placesLayerRef.current) map.removeLayer(placesLayerRef.current);
    markerCluster.clearLayers();

    if (activeMode === "explore") {
      if (placesLayerRef.current) placesLayerRef.current.addTo(map);
      refreshComplaints();
    } else if (activeMode === "aqi") {
      refreshAqiLayer();
    } else if (activeMode === "heatmap") {
      refreshComplaints();
    }
  };

  const resolveAndRenderPlace = async (lat, lng) => {
    const map = mapInstance.current;
    if (!map) return;

    try {
      const resolved = await api(`/api/places/resolve?lat=${lat}&lng=${lng}`);
      setSelectedPlace(resolved);

      if (resolved.is_virtual) {
        if (selectedLayerRef.current) {
          const oldFeature = selectedLayerRef.current.feature;
          if (typeof selectedLayerRef.current.setStyle === "function") {
            selectedLayerRef.current.setStyle(getPlaceStyle(oldFeature, "base"));
          }
          selectedLayerRef.current = null;
        }
        if (selectionMarkerRef.current) map.removeLayer(selectionMarkerRef.current);
        const tempIcon = L.divIcon({
          className: "",
          html: `<div class="place-pin" style="border-color: #f43f5e; box-shadow: 0 0 12px #f43f5e;">📍</div>`,
          iconSize: [26, 26]
        });
        selectionMarkerRef.current = L.marker([lat, lng], { icon: tempIcon }).addTo(map);
      } else {
        if (selectionMarkerRef.current) {
          map.removeLayer(selectionMarkerRef.current);
          selectionMarkerRef.current = null;
        }
        if (placesLayerRef.current) {
          placesLayerRef.current.eachLayer((layer) => {
            if (layer.feature && layer.feature.properties && layer.feature.properties.place_id === resolved.place.properties.place_id) {
              if (selectedLayerRef.current && selectedLayerRef.current !== layer) {
                if (typeof selectedLayerRef.current.setStyle === "function") {
                  selectedLayerRef.current.setStyle(getPlaceStyle(selectedLayerRef.current.feature, "base"));
                }
              }
              selectedLayerRef.current = layer;
              if (typeof layer.setStyle === "function") {
                layer.setStyle(getPlaceStyle(layer.feature, "selected"));
              }
            }
          });
        }
      }

      const placeId = resolved.place.properties.place_id;
      const [reviewsList, complaintsList] = await Promise.all([
        api(`/api/places/${encodeURIComponent(placeId)}/reviews`),
        api(`/api/complaints?place_id=${encodeURIComponent(placeId)}&include_moderation=true`)
      ]);
      setReviews(reviewsList);
      setPlaceComplaints(complaintsList);

      if (activeTabRef.current !== "map") {
        setActiveTab("map");
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const onSubmitReview = async (e) => {
    e.preventDefault();
    if (!selectedPlace || !selectedLatlng) return;

    const placeId = selectedPlace.place.properties.place_id;
    const formData = new FormData(e.target);

    try {
      await api(`/api/places/${encodeURIComponent(placeId)}/reviews`, {
        method: "POST",
        body: JSON.stringify({
          rating: Number(formData.get("rating")),
          comment: String(formData.get("comment") || "").trim(),
          user_id: userId
        })
      });

      e.target.reset();
      fetchedAreasCache.current = {};
      await resolveAndRenderPlace(selectedLatlng.lat, selectedLatlng.lng);
      await refreshMetrics();
      await refreshAqiLayer(null, true);
    } catch (err) {
      alert(err.message);
    }
  };

  const onSubmitComplaint = async (e) => {
    e.preventDefault();
    if (!selectedPlace || !selectedLatlng) return;

    const place = selectedPlace.place.properties;
    const formData = new FormData(e.target);
    setIsSubmitting(true);

    try {
      const response = await api(`/api/places/${encodeURIComponent(place.place_id)}/complaints`, {
        method: "POST",
        body: JSON.stringify({
          place_name: place.name,
          place_type: place.type,
          address: place.address,
          street: formData.get("street") ? String(formData.get("street")).trim() : "",
          issue_type: formData.get("issue_type"),
          severity: Number(formData.get("severity")),
          description: String(formData.get("description") || "").trim(),
          latitude: selectedLatlng.lat,
          longitude: selectedLatlng.lng,
          user_trust_score: userTrustScore,
          image: uploadedImage
        })
      });

      e.target.reset();
      setUploadedImage(null);

      if (response.status === "Moderation") {
        showToast("⚠️ Your complaint was routed to Human Moderation. Reason: NLP flag or low trust score.", "warning");
      } else if (response.is_duplicate) {
        showToast("⚠️ Similar issue reported recently. AI flagged this complaint as duplicate.", "warning");
      } else {
        showToast("Complaint filed successfully. Assigned routing transparently logged.", "success");
      }

      fetchedAreasCache.current = {};
      await resolveAndRenderPlace(selectedLatlng.lat, selectedLatlng.lng);
      await refreshMetrics();
      await refreshComplaints();
      await refreshAqiLayer(null, true);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = () => {
    setUserVerifiedOtp(true);
    setUserTrustScore(prev => Math.min(100, prev + 10));
    alert("✅ Mobile OTP verified successfully! Trust Score increased by 10.");
  };

  const handleVerifyAadhaar = () => {
    setUserVerifiedAadhaar(true);
    setUserTrustScore(prev => Math.min(100, prev + 30));
    alert("✅ Aadhaar identity verified successfully! Trust Score increased by 30.");
  };

  const handleFlagComplaint = async (complaintId) => {
    try {
      const res = await api(`/api/complaints/${encodeURIComponent(complaintId)}/flag`, { method: "POST" });
      alert(`🚩 Flagged. Current flags: ${res.flags_count}. Status: ${res.status}`);
      if (selectedLatlng) {
        await resolveAndRenderPlace(selectedLatlng.lat, selectedLatlng.lng);
      }
      await refreshMetrics();
      await refreshComplaints();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVerifyResolution = async (complaintId, outcome) => {
    try {
      await api(`/api/complaints/${encodeURIComponent(complaintId)}/verify`, {
        method: "POST",
        body: JSON.stringify({ outcome })
      });
      alert(`Outcome: ${outcome} submitted successfully!`);
      fetchedAreasCache.current = {};
      loadMyReports();
      refreshMetrics();
      refreshComplaints();
      await refreshAqiLayer(null, true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusAdvance = async (complaintId, newStatus) => {
    try {
      await api(`/api/complaints/${encodeURIComponent(complaintId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });
      alert(`Complaint status successfully advanced to: ${newStatus || "next stage"}`);
      fetchedAreasCache.current = {};
      loadGovernanceData();
      refreshMetrics();
      refreshComplaints();
      await refreshAqiLayer(null, true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePhotoUploadSimulation = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setUploadedImage(event.target.result);
          console.log("SIMULATOR: EXIF Metadata stripped successfully.");
          console.log("SIMULATOR: Face detection model triggered. Blurring faces on client-side canvas.");
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const searchTimeoutRef = useRef(null);

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api(`/api/places?q=${encodeURIComponent(q)}&limit=8`);
      setSearchResults(res.features || []);
    } catch (err) {
      console.error(err);
    }
  };

  const selectSearchResult = async (feature) => {
    setSearchQuery("");
    setSearchResults([]);
    const map = mapInstance.current;
    if (!map) return;

    let coords = [];
    if (feature.properties && feature.properties.center) {
      // Backend center is [lng, lat], Leaflet needs [lat, lng]
      coords = [feature.properties.center[1], feature.properties.center[0]];
    } else if (feature.geometry) {
      const geom = feature.geometry;
      if (geom.type === "Point") coords = [geom.coordinates[1], geom.coordinates[0]];
      else if (geom.type === "LineString") coords = [geom.coordinates[0][1], geom.coordinates[0][0]];
      else if (geom.type === "Polygon") coords = [geom.coordinates[0][0][1], geom.coordinates[0][0][0]];
      else if (geom.type === "MultiPolygon") coords = [geom.coordinates[0][0][0][1], geom.coordinates[0][0][0][0]];
      else if (geom.type === "MultiLineString") coords = [geom.coordinates[0][0][1], geom.coordinates[0][0][0]];
    }

    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      map.flyTo(coords, 16, { duration: 0.8 });
      setSelectedLatlng({ lat: coords[0], lng: coords[1] });
      await resolveAndRenderPlace(coords[0], coords[1]);
    }
  };

  const scoreToColor = (score) => {
    if (score >= 81) return "#10b981"; // excellent - green
    if (score >= 61) return "#84cc16"; // good - lime
    if (score >= 31) return "#fbbf24"; // moderate - amber
    return "#f43f5e"; // critical - rose
  };

  return (
    <>
      <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {/* SIDEBAR */}
        <aside 
          className={`sidebar ${isSidebarOpen ? 'w-[320px]' : 'w-[80px]'}`}
        >
          {/* Toggle Button */}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="sidebar-toggle"
          >
            {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          <div className={`p-6 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 overflow-hidden px-0'}`}>
            <h1 className="text-xl font-bold m-0 flex items-center gap-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
              <span className="sidebar-brand-dot"></span>
              {isSidebarOpen && <span className="sidebar-brand-title">Nirikshan Ledger</span>}
            </h1>
            {isSidebarOpen && <p className="sidebar-brand-subtitle mt-1 ml-4 whitespace-nowrap">Civic Quality Mapping</p>}
          </div>

          <nav className={`flex flex-col gap-2 mt-2 ${isSidebarOpen ? 'px-4' : 'px-3'} transition-all`}>
            <button 
              className={`sidebar-nav-btn ${activeTab === "map" ? "active" : ""} ${!isSidebarOpen ? 'justify-center px-3' : ''}`}
              onClick={() => setActiveTab("map")}
              title="Map Explorer"
            >
              <span className="text-lg shrink-0">🗺️</span>
              {isSidebarOpen && "Map Explorer"}
            </button>
            <button 
              className={`sidebar-nav-btn ${activeTab === "citizen" ? "active" : ""} ${!isSidebarOpen ? 'justify-center px-3' : ''}`}
              onClick={() => setActiveTab("citizen")}
              title="Citizen Grievances"
            >
              <span className="text-lg shrink-0">📢</span>
              {isSidebarOpen && "Citizen Grievances"}
            </button>
          </nav>

          {/* MAP MODES IN SIDEBAR */}
          {activeTab === "map" && isSidebarOpen && (
            <div className="mt-8 px-4 flex flex-col gap-4 mb-6 overflow-y-auto" style={{ animation: 'fadeInShortcuts 0.4s ease' }}>
              <div className="sidebar-section">
                <h4 className="sidebar-section-title">
                  <Layers size={14} style={{ color: 'var(--accent-1)' }} /> Map Visual Modes
                </h4>
                <div className="radio-input">
                  <div className="glass">
                    <div className="glass-inner"></div>
                  </div>
                  <div className="selector">
                    <div className="choice" onClick={() => setActiveMode("explore")}>
                      <div>
                        <input className="choice-circle" checked={activeMode === "explore"} readOnly type="radio" id="mode-explore" />
                        <div className="ball"></div>
                      </div>
                      <label htmlFor="mode-explore" className="choice-name">
                        <span className="text-lg"></span> Explore & Rate
                      </label>
                    </div>
                    <div className="choice" onClick={() => setActiveMode("aqi")}>
                      <div>
                        <input className="choice-circle" checked={activeMode === "aqi"} readOnly type="radio" id="mode-aqi" />
                        <div className="ball"></div>
                      </div>
                      <label htmlFor="mode-aqi" className="choice-name">
                        <span className="text-lg"></span> Civic AQI Layers
                      </label>
                    </div>
                    <div className="choice" onClick={() => setActiveMode("heatmap")}>
                      <div>
                        <input className="choice-circle" checked={activeMode === "heatmap"} readOnly type="radio" id="mode-heatmap" />
                        <div className="ball"></div>
                      </div>
                      <label htmlFor="mode-heatmap" className="choice-name">
                        <span className="text-lg"></span> Complaint Heatmap
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="sidebar-divider">
                  <span className="sidebar-label">Map Theme:</span>
                  <div className="flex gap-2">
                    <button className={`sidebar-theme-btn ${mapTheme === "dark" ? "active" : ""}`} onClick={() => setMapTheme("dark")}>🌑 Dark</button>
                    <button className={`sidebar-theme-btn ${mapTheme === "street" ? "active" : ""}`} onClick={() => setMapTheme("street")}>🗺️ Street</button>
                    <button className={`sidebar-theme-btn ${mapTheme === "satellite" ? "active" : ""}`} onClick={() => setMapTheme("satellite")}>🛰️ Satellite</button>
                  </div>
                </div>

                <div className="sidebar-divider">
                  <span className="sidebar-label">Focus City:</span>
                  <div className="flex gap-2">
                    <button className="sidebar-theme-btn" onClick={() => { if (mapInstance.current) { mapInstance.current.flyTo([26.4499, 80.3319], 13, { duration: 1.2 }); } }} title="Fly to Kanpur Wards">🏭 Kanpur</button>
                    <button className="sidebar-theme-btn" onClick={() => { if (mapInstance.current) { mapInstance.current.flyTo([26.8467, 80.9462], 13, { duration: 1.2 }); } }} title="Fly to Lucknow Wards">🏛️ Lucknow</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* MAIN CONTENT WRAPPER */}
        <div className="flex-1 flex flex-col relative overflow-hidden min-w-0">
          {/* TOP NAVBAR */}
          <header className="navbar">
            <div className="relative w-96">
              <input
                id="search-input"
                type="text"
                placeholder="Search road, park, home, shop, landmark..."
                value={searchQuery}
                onChange={handleSearch}
                autoComplete="off"
              />
              {searchResults.length > 0 && (
                <ul className="search-results visible">
                  {searchResults.map((f, i) => (
                    <li key={i} onClick={() => selectSearchResult(f)}>
                      <strong>{f.properties.name}</strong>
                      <small>{f.properties.type} - {f.properties.address}</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                className="theme-toggle"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {citizenUser ? (
                <div className="relative nav-user-wrapper">
                  <button className="nav-user-btn">
                    <span style={{ color: 'var(--accent-1)', fontWeight: 600, fontSize: '0.88rem' }}>👤 {citizenUser.name}</span>
                    <span style={{ color: 'var(--green)', fontSize: '0.75rem', fontFamily: 'monospace' }}>⭐ {userTrustScore}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 4 }}>▼</span>
                  </button>
                  <div className="nav-user-dropdown">
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-primary)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Signed in as</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{citizenUser.email || citizenEmail}</div>
                    </div>
                    <div style={{ padding: '4px 0' }}>
                      <button className="nav-user-dropdown-item">My Profile</button>
                      <button className="nav-user-dropdown-item">My Reports</button>
                      <button className="nav-user-dropdown-item">Settings</button>
                    </div>
                    <div style={{ height: 1, background: 'var(--border-primary)', margin: '4px 0' }}></div>
                    <div style={{ padding: '4px 0' }}>
                      <button className="nav-user-dropdown-item danger" onClick={handleCitizenLogout}>Sign Out</button>
                    </div>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setShowCitizenModal(true)} 
                  className="sign-in-btn"
                >
                  👤 Citizen Sign In
                </button>
              )}
            </div>
          </header>

          <main className="flex-1 relative overflow-hidden w-full h-full p-0">
        <section className={`w-full h-full relative ${activeTab === 'map' ? 'block' : 'hidden'}`}>

          {/* Live Location Preview HUD */}
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
                <span className="hud-text-idle">Hover over any region or boundary to preview location & AQI</span>
              </div>
            )}
          </div>

          <div className="stats-row">
            <article><strong>{summary.total}</strong><span>Total Ledger</span></article>
            <article><strong>{summary.pending}</strong><span>Pending</span></article>
            <article><strong>{summary.resolved}</strong><span>Resolved</span></article>
            <article><strong>{summary.highPriority}</strong><span>High/Critical</span></article>
          </div>

          {activeMode === "aqi" && !selectedPlace && (
            <div className="legend-card" id="map-legend">
              <h3>Area Quality Index (AQI)</h3>
              <p id="zoom-level-text">Active Level: Boundary Zoom Zoom</p>
              <div className="legend-scale">
                <div className="scale-item"><span className="swatch excellent"></span><strong>81-100</strong> Well-maintained</div>
                <div className="scale-item"><span className="swatch good"></span><strong>61-80</strong> Acceptable</div>
                <div className="scale-item"><span className="swatch moderate"></span><strong>31-60</strong> Poor</div>
                <div className="scale-item"><span className="swatch critical"></span><strong>0-30</strong> Critical</div>
              </div>
            </div>
          )}

          <div ref={mapRef} id="map" className="absolute inset-0 z-0"></div>

          <div className="map-perf-badge" title="Hardware accelerated canvas & progressive background streaming">
            <span className={`sync-dot ${bgSyncStatus}`}></span>
            <span>{bgSyncStatus === "syncing" ? "⚡ Streaming background areas..." : "⚡ Fast Vector Engine • Active"}</span>
          </div>

          <button 
            className={`btn-keyboard ${showShortcuts ? "active" : ""}`} 
            onClick={() => setShowShortcuts(prev => !prev)}
            title="Keyboard Shortcuts Guide"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
              <line x1="6" y1="8" x2="6" y2="8"></line>
              <line x1="10" y1="8" x2="10" y2="8"></line>
              <line x1="14" y1="8" x2="14" y2="8"></line>
              <line x1="18" y1="8" x2="18" y2="8"></line>
              <line x1="6" y1="12" x2="6" y2="12"></line>
              <line x1="10" y1="12" x2="10" y2="12"></line>
              <line x1="14" y1="12" x2="14" y2="12"></line>
              <line x1="18" y1="12" x2="18" y2="12"></line>
              <line x1="7" y1="16" x2="17" y2="16"></line>
            </svg>
          </button>

          {showShortcuts && (
            <div className="shortcuts-overlay">
              <h3>
                <span>⌨️ Keyboard Shortcuts</span>
                <button 
                  onClick={() => setShowShortcuts(false)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px", padding: 0 }}
                >
                  ✕
                </button>
              </h3>
              <div className="shortcuts-list">
                <div className="shortcut-item">
                  <span>Pan Map</span>
                  <div className="shortcut-keys">
                    <span className="shortcut-key">W</span>
                    <span className="shortcut-key">A</span>
                    <span className="shortcut-key">S</span>
                    <span className="shortcut-key">D</span>
                    <span className="shortcut-key">↑↓←→</span>
                  </div>
                </div>
                <div className="shortcut-item">
                  <span>Zoom In / Out</span>
                  <div className="shortcut-keys">
                    <span className="shortcut-key">E</span>
                    <span className="shortcut-key">Q</span>
                    <span className="shortcut-key">+</span>
                    <span className="shortcut-key">-</span>
                  </div>
                </div>
                <div className="shortcut-item">
                  <span>Reset View</span>
                  <div className="shortcut-keys">
                    <span className="shortcut-key">R</span>
                  </div>
                </div>
                <div className="shortcut-item">
                  <span>Toggle Map Theme</span>
                  <div className="shortcut-keys">
                    <span className="shortcut-key">T</span>
                  </div>
                </div>
                <div className="shortcut-item">
                  <span>Locate Me</span>
                  <div className="shortcut-keys">
                    <span className="shortcut-key">C</span>
                    <span className="shortcut-key">U</span>
                  </div>
                </div>
                <div className="shortcut-item">
                  <span>Explore Mode</span>
                  <div className="shortcut-keys">
                    <span className="shortcut-key">1</span>
                  </div>
                </div>
                <div className="shortcut-item">
                  <span>AQI Mode</span>
                  <div className="shortcut-keys">
                    <span className="shortcut-key">2</span>
                  </div>
                </div>
                <div className="shortcut-item">
                  <span>Heatmap Mode</span>
                  <div className="shortcut-keys">
                    <span className="shortcut-key">3</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button 
            className={`btn-locate ${isLocating ? "active" : ""}`} 
            onClick={handleLocateMe}
            title="Show My Location"
          >
            {isLocating ? (
              <div className="loader-locate"></div>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="7"></circle>
                <line x1="12" y1="1" x2="12" y2="5"></line>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="1" y1="12" x2="5" y2="12"></line>
                <line x1="19" y1="12" x2="23" y2="12"></line>
              </svg>
            )}
          </button>
        </section>

        {/* FLOATING SELECTED AREA POPUP */}
        {selectedPlace && (
          <div className="absolute right-6 top-6 bottom-6 w-[380px] z-[2000] flex flex-col pointer-events-none">
            <div className="pointer-events-auto place-popup">
              
              {/* Header */}
              <div className="place-popup-header">
                <div className="flex justify-between items-start">
                  <div>
                    <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-1)', fontWeight: 700, marginBottom: 4 }}>
                      {`${selectedPlace.place.properties.type} ${selectedPlace.is_virtual ? "(pin drop)" : ""}`}
                    </p>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{selectedPlace.place.properties.name}</h2>
                  </div>
                  <button 
                    onClick={handleClosePlace}
                    className="place-popup-close"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  {selectedPlace.place.properties.address || "No address metadata"}
                </p>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                   <span>🏛️</span>
                   <span>{selectedPlace.area ? `${selectedPlace.area.name}, ${selectedPlace.area.city} | Auth: ${selectedPlace.area.authority}` : "Outside mapped region"}</span>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="place-popup-content">
                
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <div className="place-popup-metric">
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quality</span>
                    <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>{selectedPlace.metrics.avg_rating ? `${selectedPlace.metrics.avg_rating}/5` : "N/A"}</strong>
                  </div>
                  <div className="place-popup-metric">
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reviews</span>
                    <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>{selectedPlace.metrics.review_count}</strong>
                  </div>
                  <div className="place-popup-metric">
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Complaints</span>
                    <strong style={{ fontSize: '1.25rem', color: 'var(--red)', fontWeight: 600 }}>{selectedPlace.metrics.complaint_count}</strong>
                  </div>
                  <div className="place-popup-metric">
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pending</span>
                    <strong style={{ fontSize: '1.25rem', color: 'var(--yellow)', fontWeight: 600 }}>{selectedPlace.metrics.pending_complaints}</strong>
                  </div>
                </div>
              
                <div style={{ height: 1, background: 'var(--border-primary)', width: '100%', flexShrink: 0 }}></div>

                {selectedPlace.area ? (
                  <>
                    {/* Forms Section */}
                    <div className="flex flex-col gap-4 shrink-0">
                       {/* Rating Form */}
                       <div className="place-popup-form">
                         <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                           <span style={{ color: 'var(--yellow)', fontSize: '1rem' }}>★</span> Rate Quality
                         </h3>
                         <form onSubmit={onSubmitReview} className="flex flex-col gap-3">
                           <div>
                             <select name="rating" required className="place-popup-form-input">
                               <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
                               <option value="4">⭐⭐⭐⭐ Good</option>
                               <option value="3">⭐⭐⭐ Moderate</option>
                               <option value="2">⭐⭐ Poor</option>
                               <option value="1">⭐ Critical Issue</option>
                             </select>
                           </div>
                           <div>
                             <textarea name="comment" rows="2" maxLength="260" placeholder="Describe the conditions..." required className="place-popup-form-input" style={{ resize: 'none' }}></textarea>
                           </div>
                           <button type="submit" className="btn-secondary" style={{ fontSize: '0.78rem' }}>Post Review</button>
                         </form>
                       </div>

                       {/* Complaint Form */}
                       <div className="place-popup-form danger">
                         <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                           <span style={{ color: 'var(--red)', fontSize: '1rem' }}>⚠️</span> File a Complaint
                         </h3>
                         <div style={{ fontSize: '10px', color: 'var(--red)', background: 'var(--red-bg)', padding: 8, borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 6, lineHeight: 1.4 }}>
                           <span style={{ flexShrink: 0, fontSize: '0.78rem' }}>🛡️</span> 
                           <span>GPS coordinates attached automatically. Faces will be blurred.</span>
                         </div>
                         <form onSubmit={onSubmitComplaint} className="flex flex-col gap-3">
                            <select name="issue_type" required className="place-popup-form-input">
                              <option value="Pothole">Road / Pothole</option>
                              <option value="Streetlight">Streetlight Failure</option>
                              <option value="Water">Water Supply Defect</option>
                              <option value="Sewer">Drainage / Sewer Overflow</option>
                              <option value="Garbage">Sanitation / Garbage Dump</option>
                              <option value="Safety">Public Safety Hazard</option>
                              <option value="Encroachment">Public Space Encroachment</option>
                            </select>
                            
                            <select name="severity" required className="place-popup-form-input">
                              <option value="1">Low - Minor issue</option>
                              <option value="2">Medium - Obstructive</option>
                              <option value="3">High - Safety concern</option>
                              <option value="5">Critical - Severe hazard</option>
                            </select>
                            
                            <input type="text" name="street" placeholder="Exact street / Landmark..." className="place-popup-form-input" />
                            
                            <textarea name="description" rows="2" maxLength="300" placeholder="Describe the problem..." required className="place-popup-form-input" style={{ resize: 'none' }}></textarea>
                            
                            {uploadedImage ? (
                              <div className="uploaded-image-preview" style={{ height: 96 }}>
                                <img src={uploadedImage} className="w-full h-full object-cover" style={{ opacity: 0.8 }} alt="Civic Issue" />
                                <span className="preview-badge">Face Blurred</span>
                              </div>
                            ) : (
                              <button type="button" onClick={handlePhotoUploadSimulation} className="btn-secondary" style={{ fontSize: '0.78rem', borderStyle: 'dashed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>📸 Attach Photo Evidence</button>
                            )}

                            <button type="submit" disabled={isSubmitting} style={{ width: '100%', background: 'var(--red)', color: '#fff', fontWeight: 500, fontSize: '0.78rem', padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s', opacity: isSubmitting ? 0.5 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(244, 63, 94, 0.2)' }}>
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading & Submitting...
                                </>
                              ) : "Submit Complaint"}
                            </button>
                         </form>
                       </div>
                    </div>

                    <div style={{ height: 1, background: 'var(--border-primary)', width: '100%', flexShrink: 0, marginTop: 8 }}></div>

                    {/* Lists Section */}
                    <div className="flex flex-col gap-6 shrink-0" style={{ marginTop: 8 }}>
                      <div>
                        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Recent Reviews</h3>
                        <ul className="flex flex-col gap-3">
                          {reviews.length === 0 ? (
                            <li className="glass-inner" style={{ padding: '8px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No reviews yet.</li>
                          ) : (
                            reviews.slice(0, 5).map((r, i) => (
                              <li key={i} className="glass-inner" style={{ padding: 12 }}>
                                <div className="flex justify-between items-center mb-1">
                                  <span style={{ color: 'var(--yellow)', fontSize: '0.78rem' }}>{"★".repeat(r.rating) + "☆".repeat(5 - r.rating)}</span>
                                  <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                                </div>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.comment}</p>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>

                      <div>
                        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Recent Complaints</h3>
                        <ul className="flex flex-col gap-3">
                          {placeComplaints.length === 0 ? (
                            <li className="glass-inner" style={{ padding: '8px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No complaints.</li>
                          ) : (
                            placeComplaints.slice(0, 5).map((c, i) => (
                              <li key={i} className="glass-inner" style={{ padding: 12 }}>
                                <div className="flex justify-between items-start mb-1">
                                  <span style={{ color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>{ISSUE_ICONS[c.issue_type] || "📍"} {c.issue_type}</span>
                                  <span className={`badge-status ${c.status === 'Resolved' ? 'resolved' : 'inprogress'}`}>{c.status}</span>
                                </div>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '6px 0' }}>{c.description}</p>
                                <div className="flex justify-between items-center" style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                  <span>Dept: {c.department}</span>
                                  <button onClick={() => handleFlagComplaint(c.complaint_id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '9px', transition: 'color 0.2s' }}>🚩 Spam ({c.flags_count || 0})</button>
                                </div>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ background: 'var(--yellow-bg)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 12, padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 8, flexShrink: 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--yellow-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                      🚫
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--yellow)', marginBottom: 6 }}>Out of Bounds</h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        This location falls outside our currently supported civic jurisdictions. Feedback and complaint services are disabled for this area.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
          </main>
        </div> {/* END app-main */}
      </div> {/* END app-container */}

      {/* Citizen Authentication Modal */}
      {showCitizenModal && (
        <div className="auth-modal-backdrop">
          <div className="auth-modal">
            <button onClick={() => setShowCitizenModal(false)} className="auth-modal-close">✕</button>

            <h3 className="auth-modal-title">Citizen Sign In</h3>

            {/* Quick Citizen Test Profiles */}
            <div className="auth-quick-profiles">
              <span className="auth-quick-label">
                ⚡ Quick Citizen Test Profiles
              </span>
              <div className="auth-quick-grid">
                <button
                  type="button"
                  onClick={() => handleCitizenAuth("rahul.sharma@example.com", "citizen123")}
                  className="auth-quick-btn"
                >
                  <span className="auth-quick-btn-name">Rahul Sharma</span>
                  <span className="auth-quick-btn-info">Lucknow (Trust: 85)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCitizenAuth("priya.verma@example.com", "citizen123")}
                  className="auth-quick-btn"
                >
                  <span className="auth-quick-btn-name">Priya Verma</span>
                  <span className="auth-quick-btn-info">Kanpur (Trust: 90)</span>
                </button>
              </div>
            </div>

            {citizenAuthError && (
              <div className="auth-error">
                ⚠️ {citizenAuthError}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleCitizenAuth(); }} className="flex flex-col" style={{ gap: 10 }}>
              <div className="flex flex-col">
                <label className="auth-field-label">Email</label>
                <div className="auth-field-wrap">
                  <svg height="20" viewBox="0 0 32 32" width="20" xmlns="http://www.w3.org/2000/svg" className="auth-icon">
                    <g id="Layer_3" data-name="Layer 3"><path d="m30.853 13.87a15 15 0 0 0 -29.729 4.082 15.1 15.1 0 0 0 12.876 12.918 15.6 15.6 0 0 0 2.016.13 14.85 14.85 0 0 0 7.715-2.145 1 1 0 1 0 -1.031-1.711 13.007 13.007 0 1 1 5.458-6.529 2.149 2.149 0 0 1 -4.158-.759v-10.856a1 1 0 0 0 -2 0v1.726a8 8 0 1 0 .2 10.325 4.135 4.135 0 0 0 7.83.274 15.2 15.2 0 0 0 .823-7.455zm-14.853 8.13a6 6 0 1 1 6-6 6.006 6.006 0 0 1 -6 6z"></path></g>
                  </svg>
                  <input 
                    type="email" 
                    className="auth-field-input" 
                    placeholder="Enter your Email"
                    value={citizenEmail}
                    onChange={(e) => setCitizenEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col" style={{ marginTop: 8 }}>
                <label className="auth-field-label">Password</label>
                <div className="auth-field-wrap" style={{ paddingRight: 16 }}>
                  <svg height="20" viewBox="-64 0 512 512" width="20" xmlns="http://www.w3.org/2000/svg" className="auth-icon"><path d="m336 512h-288c-26.453125 0-48-21.523438-48-48v-224c0-26.476562 21.546875-48 48-48h288c26.453125 0 48 21.523438 48 48v224c0 26.476562-21.546875 48-48 48zm-288-288c-8.8125 0-16 7.167969-16 16v224c0 8.832031 7.1875 16 16 16h288c8.8125 0 16-7.167969 16-16v-224c0-8.832031-7.1875-16-16-16zm0 0"></path><path d="m304 224c-8.832031 0-16-7.167969-16-16v-80c0-52.929688-43.070312-96-96-96s-96 43.070312-96 96v80c0 8.832031-7.167969 16-16 16s-16-7.167969-16-16v-80c0-70.59375 57.40625-128 128-128s128 57.40625 128 128v80c0 8.832031-7.167969 16-16 16zm0 0"></path></svg>        
                  <input 
                    type="password" 
                    className="auth-field-input" 
                    placeholder="Enter your Password"
                    value={citizenPassword}
                    onChange={(e) => setCitizenPassword(e.target.value)}
                    required
                  />
                  <svg viewBox="0 0 576 512" height="1em" xmlns="http://www.w3.org/2000/svg" className="auth-icon" style={{ cursor: 'pointer', marginLeft: 8 }}><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"></path></svg>
                </div>
              </div>
            
              <div className="auth-remember-row">
                <div className="flex items-center" style={{ gap: 10 }}>
                  <input type="checkbox" id="remember" className="auth-checkbox" />
                  <label htmlFor="remember" className="auth-remember-label">Remember me</label>
                </div>
                <span className="auth-link">Forgot password?</span>
              </div>
              
              <button type="submit" className="auth-submit-btn">
                Sign In
              </button>
            </form>

            <p className="auth-footer">
              Don't have an account? <span className="auth-link" style={{ marginLeft: 4 }}>Sign Up</span>
            </p>
            
            <div className="auth-divider">
              <div className="auth-divider-line"></div>
              <p className="auth-divider-text">Or With</p>
              <div className="auth-divider-line"></div>
            </div>

            <div className="flex flex-row" style={{ gap: 10 }}>
              <button type="button" className="auth-social-btn">
                <svg version="1.1" width="20" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" style={{enableBackground:"new 0 0 512 512"}} xmlSpace="preserve">
                  <path style={{fill:"#FBBB00"}} d="M113.47,309.408L95.648,375.94l-65.139,1.378C11.042,341.211,0,299.9,0,256c0-42.451,10.324-82.483,28.624-117.732h0.014l57.992,10.632l25.404,57.644c-5.317,15.501-8.215,32.141-8.215,49.456C103.821,274.792,107.225,292.797,113.47,309.408z"></path>
                  <path style={{fill:"#518EF8"}} d="M507.527,208.176C510.467,223.662,512,239.655,512,256c0,18.328-1.927,36.206-5.598,53.451c-12.462,58.683-45.025,109.925-90.134,146.187l-0.014-0.014l-73.044-3.727l-10.338-64.535c29.932-17.554,53.324-45.025,65.646-77.911h-136.89V208.176h138.887L507.527,208.176L507.527,208.176z"></path>
                  <path style={{fill:"#28B446"}} d="M416.253,455.624l0.014,0.014C372.396,490.901,316.666,512,256,512c-97.491,0-182.252-54.491-225.491-134.681l82.961-67.91c21.619,57.698,77.278,98.771,142.53,98.771c28.047,0,54.323-7.582,76.87-20.818L416.253,455.624z"></path>
                  <path style={{fill:"#F14336"}} d="M419.404,58.936l-82.933,67.896c-23.335-14.586-50.919-23.012-80.471-23.012c-66.729,0-123.429,42.957-143.965,102.724l-83.397-68.276h-0.014C71.23,56.123,157.06,0,256,0C318.115,0,375.068,22.126,419.404,58.936z"></path>
                </svg>
                Google 
              </button>
              
              <button type="button" className="auth-social-btn">
                <svg version="1.1" height="20" width="20" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 22.773 22.773" style={{enableBackground:"new 0 0 22.773 22.773"}} xmlSpace="preserve" className="auth-icon">
                  <g><g> <path d="M15.769,0c0.053,0,0.106,0,0.162,0c0.13,1.606-0.483,2.806-1.228,3.675c-0.731,0.863-1.732,1.7-3.351,1.573 c-0.108-1.583,0.506-2.694,1.25-3.561C13.292,0.879,14.557,0.16,15.769,0z"></path> <path d="M20.67,16.716c0,0.016,0,0.03,0,0.045c-0.455,1.378-1.104,2.559-1.896,3.655c-0.723,0.995-1.609,2.334-3.191,2.334 c-1.367,0-2.275-0.879-3.676-0.903c-1.482-0.024-2.297,0.735-3.652,0.926c-0.155,0-0.31,0-0.462,0 c-0.995-0.144-1.798-0.932-2.383-1.642c-1.725-2.098-3.058-4.808-3.306-8.276c0-0.34,0-0.679,0-1.019 c0.105-2.482,1.311-4.5,2.914-5.478c0.846-0.52,2.009-0.963,3.304-0.765c0.555,0.086,1.122,0.276,1.619,0.464 c0.471,0.181,1.06,0.502,1.618,0.485c0.378-0.011,0.754-0.208,1.135-0.347c1.116-0.403,2.21-0.865,3.652-0.648 c1.733,0.262,2.963,1.032,3.723,2.22c-1.466,0.933-2.625,2.339-2.427,4.74C17.818,14.688,19.086,15.964,20.67,16.716z"></path> </g></g>
                </svg>
                Apple 
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="toast-container">
          <div className={`toast ${toastMessage.type}`}>
            {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'var(--green)' }} />}
            {toastMessage.type === 'error' && <XCircle className="w-5 h-5 shrink-0" style={{ color: 'var(--red)' }} />}
            {toastMessage.type === 'warning' && <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: 'var(--yellow)' }} />}
            <p className="toast-text">
              {toastMessage.message}
            </p>
            <button onClick={() => setToastMessage(null)} className="toast-close">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

