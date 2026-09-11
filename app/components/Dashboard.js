"use client";

import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { ChevronLeft, ChevronRight, Map, AlertTriangle, Layers, Settings, LogOut, Search } from "lucide-react";

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

    if (activeModeRef.current === "aqi" || activeModeRef.current === "heatmap") {
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
    if (activeModeRef.current !== "aqi" && activeModeRef.current !== "heatmap") return;
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
        if (c.is_duplicate) {
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
      refreshAqiLayer();
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

    try {
      const response = await api(`/api/places/${encodeURIComponent(place.place_id)}/complaints`, {
        method: "POST",
        body: JSON.stringify({
          place_name: place.name,
          place_type: place.type,
          address: place.address,
          issue_type: formData.get("issue_type"),
          severity: Number(formData.get("severity")),
          description: String(formData.get("description") || "").trim(),
          latitude: selectedLatlng.lat,
          longitude: selectedLatlng.lng,
          user_trust_score: userTrustScore
        })
      });

      e.target.reset();
      setUploadedImage(null);

      if (response.status === "Moderation") {
        alert("⚠️ Your complaint was routed to the Human Moderation Queue. Reason: Description flagged by AI NLP checks or trust score remains below threshold.");
      } else if (response.is_duplicate) {
        alert("⚠️ Similar issue reported recently in this area. AI flagged this complaint as duplicate and linked it to the existing ticket.");
      } else {
        alert("✅ Complaint filed successfully. Assigned routing transparently logged.");
      }

      fetchedAreasCache.current = {};
      await resolveAndRenderPlace(selectedLatlng.lat, selectedLatlng.lng);
      await refreshMetrics();
      await refreshComplaints();
      await refreshAqiLayer(null, true);
    } catch (err) {
      alert(err.message);
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
      <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
        {/* SIDEBAR */}
        <aside 
          className={`${isSidebarOpen ? 'w-[320px]' : 'w-[80px]'} transition-all duration-300 ease-in-out bg-white/5 backdrop-blur-3xl border-r border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] flex flex-col z-[1000] shrink-0 relative`}
        >
          {/* Toggle Button */}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute -right-3 top-6 bg-slate-800 border border-slate-700 rounded-full p-1 text-white hover:bg-slate-700 z-50 shadow-lg flex items-center justify-center transition-transform hover:scale-110"
          >
            {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          <div className={`p-6 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 overflow-hidden px-0'}`}>
            <h1 className="text-xl font-bold m-0 text-white flex items-center gap-2 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] shrink-0"></span>
              {isSidebarOpen && "Nirikshan Ledger"}
            </h1>
            {isSidebarOpen && <p className="text-xs text-slate-400 mt-1 ml-4 whitespace-nowrap">Civic Quality Mapping</p>}
          </div>

          <nav className={`flex flex-col gap-2 mt-2 ${isSidebarOpen ? 'px-4' : 'px-3'} transition-all`}>
            <button 
              className={`flex items-center gap-3 py-3 rounded-xl border text-sm font-medium transition-all text-left whitespace-nowrap overflow-hidden ${isSidebarOpen ? 'px-4' : 'px-3 justify-center'} ${activeTab === "map" ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/40 text-white shadow-[0_4px_20px_rgba(99,102,241,0.2)]" : "bg-transparent border-transparent text-slate-400 hover:bg-white/10 hover:text-slate-200"}`} 
              onClick={() => setActiveTab("map")}
              title="Map Explorer"
            >
              <span className="text-lg shrink-0">🗺️</span>
              {isSidebarOpen && "Map Explorer"}
            </button>
            <button 
              className={`flex items-center gap-3 py-3 rounded-xl border text-sm font-medium transition-all text-left whitespace-nowrap overflow-hidden ${isSidebarOpen ? 'px-4' : 'px-3 justify-center'} ${activeTab === "citizen" ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/40 text-white shadow-[0_4px_20px_rgba(99,102,241,0.2)]" : "bg-transparent border-transparent text-slate-400 hover:bg-white/10 hover:text-slate-200"}`} 
              onClick={() => setActiveTab("citizen")}
              title="Citizen Grievances"
            >
              <span className="text-lg shrink-0">📢</span>
              {isSidebarOpen && "Citizen Grievances"}
            </button>
          </nav>

          {/* MAP MODES IN SIDEBAR */}
          {activeTab === "map" && isSidebarOpen && (
            <div className="mt-8 px-4 flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-500 mb-6 overflow-y-auto custom-scrollbar">
              <div className="bg-white/5 rounded-2xl border border-white/10 p-5 shadow-inner backdrop-blur-md">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Layers size={14} className="text-indigo-400" /> Map Visual Modes
                </h4>
                <div className="flex flex-col gap-2">
                  <button className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-all ${activeMode === "explore" ? "bg-indigo-500/30 border-indigo-500/50 text-white" : "bg-black/20 border-transparent text-slate-400 hover:bg-white/10 hover:text-slate-200"}`} onClick={() => setActiveMode("explore")}>
                    <span className="mr-2">🛣️</span> Explore & Rate
                  </button>
                  <button className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-all ${activeMode === "aqi" ? "bg-indigo-500/30 border-indigo-500/50 text-white" : "bg-black/20 border-transparent text-slate-400 hover:bg-white/10 hover:text-slate-200"}`} onClick={() => setActiveMode("aqi")}>
                    <span className="mr-2">📊</span> Civic AQI Layers
                  </button>
                  <button className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-all ${activeMode === "heatmap" ? "bg-indigo-500/30 border-indigo-500/50 text-white" : "bg-black/20 border-transparent text-slate-400 hover:bg-white/10 hover:text-slate-200"}`} onClick={() => setActiveMode("heatmap")}>
                    <span className="mr-2">🔥</span> Complaint Heatmap
                  </button>
                </div>
                
                <div className="mt-5 pt-4 border-t border-white/10">
                  <span className="text-xs text-slate-400 font-medium block mb-3">Map Theme:</span>
                  <div className="flex gap-2">
                    <button className={`flex-1 py-2 text-xs rounded-lg border transition-all ${mapTheme === "dark" ? "bg-indigo-500/30 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/20" : "bg-black/20 border-white/5 text-slate-400 hover:bg-white/10"}`} onClick={() => setMapTheme("dark")}>🌑 Dark</button>
                    <button className={`flex-1 py-2 text-xs rounded-lg border transition-all ${mapTheme === "street" ? "bg-indigo-500/30 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/20" : "bg-black/20 border-white/5 text-slate-400 hover:bg-white/10"}`} onClick={() => setMapTheme("street")}>🗺️ Street</button>
                    <button className={`flex-1 py-2 text-xs rounded-lg border transition-all ${mapTheme === "satellite" ? "bg-indigo-500/30 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/20" : "bg-black/20 border-white/5 text-slate-400 hover:bg-white/10"}`} onClick={() => setMapTheme("satellite")}>🛰️ Satellite</button>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-white/10">
                  <span className="text-xs text-slate-400 font-medium block mb-3">Focus City:</span>
                  <div className="flex gap-2">
                    <button className="flex-1 py-2 text-xs rounded-lg bg-black/20 border border-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all shadow-sm" onClick={() => { if (mapInstance.current) { mapInstance.current.flyTo([26.4499, 80.3319], 13, { duration: 1.2 }); } }} title="Fly to Kanpur Wards">🏭 Kanpur</button>
                    <button className="flex-1 py-2 text-xs rounded-lg bg-black/20 border border-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all shadow-sm" onClick={() => { if (mapInstance.current) { mapInstance.current.flyTo([26.8467, 80.9462], 13, { duration: 1.2 }); } }} title="Fly to Lucknow Wards">🏛️ Lucknow</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* MAIN CONTENT WRAPPER */}
        <div className="flex-1 flex flex-col relative overflow-hidden min-w-0">
          {/* TOP NAVBAR */}
          <header className="h-[72px] flex items-center justify-between px-8 bg-slate-950/60 backdrop-blur-2xl border-b border-slate-800 z-[900] shrink-0">
            <div className="relative w-96">
              <input
                id="search-input"
                type="text"
                placeholder="Search road, park, home, shop, landmark..."
                value={searchQuery}
                onChange={handleSearch}
                autoComplete="off"
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-full px-4 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-500"
              />
              {searchResults.length > 0 && (
                <ul className="absolute top-full mt-2 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                  {searchResults.map((f, i) => (
                    <li key={i} onClick={() => selectSearchResult(f)} className="px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0 transition-colors">
                      <strong className="block text-sm text-slate-100">{f.properties.name}</strong>
                      <small className="text-xs text-slate-400">{f.properties.type} - {f.properties.address}</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-4">
              {citizenUser ? (
                <div className="relative group">
                  <button className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-full px-4 py-1.5 hover:bg-slate-700 transition-colors">
                    <span className="text-cyan-400 font-semibold text-sm">👤 {citizenUser.name}</span>
                    <span className="text-emerald-400 text-xs font-mono">⭐ {userTrustScore}</span>
                    <span className="text-[10px] text-slate-400 opacity-60 ml-1">▼</span>
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-y-2 group-hover:translate-y-0 transition-all duration-200 z-[2000] overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-800">
                      <div className="text-xs text-slate-400">Signed in as</div>
                      <div className="text-sm font-semibold text-slate-100 truncate">{citizenUser.email || citizenEmail}</div>
                    </div>
                    <div className="py-1">
                      <button className="w-full text-left px-5 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">My Profile</button>
                      <button className="w-full text-left px-5 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">My Reports</button>
                      <button className="w-full text-left px-5 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">Settings</button>
                    </div>
                    <div className="h-px bg-slate-800 my-1"></div>
                    <div className="py-1">
                      <button className="w-full text-left px-5 py-2 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors" onClick={handleCitizenLogout}>Sign Out</button>
                    </div>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setShowCitizenModal(true)} 
                  className="bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 text-sm font-semibold px-5 py-2 rounded-full hover:bg-cyan-500/25 transition-all"
                >
                  👤 Citizen Sign In
                </button>
              )}
            </div>
          </header>

          <main className={`flex-1 relative overflow-hidden w-full h-full p-0`}>
        <section className={`w-full h-full relative ${activeTab === 'map' ? 'block' : 'hidden'}`}>
          {/* Map controls moved to sidebar */}

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

          {activeMode === "aqi" && (
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
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "16px", padding: 0 }}
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

        <aside className="sheet">
          {activeTab === "map" && (
            <div id="view-map" className="panel-view active">
              {selectedPlace && (
                <div className="card place-card" id="place-summary-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p id="place-type" className="place-type">
                      {`${selectedPlace.place.properties.type} ${selectedPlace.is_virtual ? "(pin drop)" : ""}`}
                    </p>
                    <button 
                      onClick={handleClosePlace}
                      className="close-place-btn"
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', fontSize: '1.2rem', lineHeight: 1 }}
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                  <h2 id="place-name">{selectedPlace.place.properties.name}</h2>
                  <p id="place-address" className="place-address">
                    {selectedPlace.place.properties.address || "No address metadata"}
                  </p>

                  <div className="metric-grid">
                    <div><label>Quality Rating</label><strong>{selectedPlace.metrics.avg_rating ? `${selectedPlace.metrics.avg_rating}/5` : "No ratings"}</strong></div>
                    <div><label>Reviews</label><strong>{selectedPlace.metrics.review_count}</strong></div>
                    <div><label>Complaints</label><strong>{selectedPlace.metrics.complaint_count}</strong></div>
                    <div><label>Pending</label><strong>{selectedPlace.metrics.pending_complaints}</strong></div>
                  </div>
                  <p id="place-jurisdiction" className="place-jurisdiction">
                    Jurisdiction: {selectedPlace.area ? `${selectedPlace.area.name}, ${selectedPlace.area.city} | Auth: ${selectedPlace.area.authority}` : "Outside mapped region"}
                  </p>
                </div>
              )}

              {selectedPlace && (
                <>
                  <div className="card form-card" id="rating-submission-card">
                    <h3>Rate Quality & Review</h3>
                    <form id="review-form" onSubmit={onSubmitReview}>
                      <div className="form-group">
                        <label>Quality Grade
                          <select name="rating" required>
                            <option value="5">⭐⭐⭐⭐⭐ Excellent (Well-maintained)</option>
                            <option value="4">⭐⭐⭐⭐ Good (Acceptable)</option>
                            <option value="3">⭐⭐⭐ Moderate</option>
                            <option value="2">⭐⭐ Poor</option>
                            <option value="1">⭐ Critical (Damaged/Broken)</option>
                          </select>
                        </label>
                      </div>
                      <div className="form-group">
                        <label>Feedback Comment
                          <textarea name="comment" rows="3" maxLength="260" placeholder="E.g. Cleanliness, water logging, lighting, road condition..." required></textarea>
                        </label>
                      </div>
                      <button type="submit" className="btn-primary">Post Review</button>
                    </form>
                  </div>

                  <div className="card form-card" id="complaint-submission-card">
                    <h3>Submit New Civic Complaint</h3>
                    <div className="alert-info">
                      🛡️ GPS and Timestamp attached. EXIF metadata will be stripped and faces automatically blurred.
                    </div>
                    
                    <form id="complaint-form" onSubmit={onSubmitComplaint}>
                      <div className="form-group">
                        <label>Issue Classification
                          <select name="issue_type" id="complaint-issue-type" required>
                            <option value="Pothole">Road / Pothole (KNN & KDA)</option>
                            <option value="Streetlight">Streetlight Failure (KNN & KDA)</option>
                            <option value="Water">Water Supply Defect (Jal Kal & KNN)</option>
                            <option value="Sewer">Drainage / Sewer Overflow (Jal Kal & KNN)</option>
                            <option value="Garbage">Sanitation / Garbage Dump (KNN)</option>
                            <option value="Safety">Public Safety Hazard (KNN)</option>
                            <option value="Encroachment">Public Space Encroachment (KDA)</option>
                          </select>
                        </label>
                      </div>
                      
                      <div className="form-group">
                        <label>Severity Level
                          <select name="severity" required>
                            <option value="1">Low - Minor issue, needs repair</option>
                            <option value="2">Medium - Obstructive, needs attention</option>
                            <option value="3">High - Safety concern or disruption</option>
                            <option value="5">Critical - Severe hazard / complete failure</option>
                          </select>
                        </label>
                      </div>
                      
                      <div className="form-group">
                        <label>Description of Issue
                          <textarea name="description" rows="3" maxLength="300" placeholder="Describe the problem and nearest landmarks..." required></textarea>
                        </label>
                      </div>

                      <div className="form-group">
                        <label>Photographic Evidence
                          <div className="photo-upload-simulator">
                            {uploadedImage && (
                              <div className="uploaded-image-preview" id="image-preview-container">
                                <img src={uploadedImage} id="image-preview" alt="Civic Issue Preview" />
                                <span className="preview-badge">🛡️ Face Blurred</span>
                              </div>
                            )}
                            <button type="button" onClick={handlePhotoUploadSimulation} className="btn-secondary">📸 Select Issue Photo</button>
                          </div>
                        </label>
                      </div>

                      <button type="submit" className="btn-primary">File Complaint</button>
                    </form>
                  </div>

                  <div className="card list-card" id="place-reviews-list-card">
                    <h3>Recent Location Reviews</h3>
                    <ul id="review-list" className="stack-list">
                      {reviews.length === 0 ? (
                        <li className="muted text-center py-3">No reviews registered for this place yet.</li>
                      ) : (
                        reviews.slice(0, 5).map((r, i) => (
                          <li key={i}>
                            <strong>
                              <span>{"★".repeat(r.rating) + "☆".repeat(5 - r.rating)}</span>
                              <span className="text-slate-400 text-[0.72rem]">{new Date(r.created_at).toLocaleString()}</span>
                            </strong>
                            <p>{r.comment}</p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  <div className="card list-card" id="place-complaints-list-card">
                    <h3>Location Complaints Ledger</h3>
                    <ul id="complaint-list" className="stack-list">
                      {placeComplaints.length === 0 ? (
                        <li className="muted text-center py-3">No complaints reported for this place yet.</li>
                      ) : (
                        placeComplaints.slice(0, 5).map((c, i) => (
                          <li key={i} className={c.escalated ? "escalated-pulse" : ""}>
                            <strong>
                              <span>{ISSUE_ICONS[c.issue_type] || "📍"} {c.issue_type}</span>
                              <span className={`badge-status ${c.status.toLowerCase().replace(" ", "")}`}>{c.status}</span>
                            </strong>
                            <p>{c.description}</p>
                            <p className="text-[0.72rem] text-slate-400 flex justify-between mt-2">
                              <span>Dept: {c.department} ({c.authority_id})</span>
                              <span>Score at Post: {c.user_trust_score}</span>
                            </p>
                            {c.verification_status === "Disputed" && <span className="disputed-flag">⚠️ Citizen Disputed</span>}
                            {c.disputed_jurisdiction && <span className="disputed-flag text-[#60a5fa] border-[rgba(96,165,250,0.2)] bg-[rgba(96,165,250,0.1)]">🌐 Overlapping Jurisdiction (Multi-Routed)</span>}
                            <div className="mt-2 flex gap-1 justify-end">
                              <button onClick={() => handleFlagComplaint(c.complaint_id)} className="status-action btn-secondary py-1 px-2 text-[0.7rem] w-auto mt-0">🚩 Flag Spam ({c.flags_count || 0})</button>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "citizen" && (
            <div id="view-citizen" className="panel-view active">
              <div className="card profile-card">
                <div className="profile-header">
                  <div className="avatar">👤</div>
                  <div>
                    <h3>Citizen Account</h3>
                    <p>Demo User Profile</p>
                  </div>
                </div>
                
                <div className="trust-score-widget">
                  <div className="score-header">
                    <span>Identity Verification Status</span>
                    <strong id="citizen-trust-score">Trust Score: {userTrustScore}/100</strong>
                  </div>
                  
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${userTrustScore}%` }}></div>
                  </div>

                  <div className="trust-status-flags">
                    <span className={`status-chip ${userVerifiedOtp ? "verified" : "unverified"}`}>
                      {userVerifiedOtp ? "📱 OTP Verified" : "📱 OTP Unverified"}
                    </span>
                    <span className={`status-chip ${userVerifiedAadhaar ? "verified" : "unverified"}`}>
                      {userVerifiedAadhaar ? "🆔 Aadhaar Verified" : "🆔 Aadhaar Unverified"}
                    </span>
                  </div>

                  <div className="verification-actions">
                    <button onClick={handleVerifyOtp} disabled={userVerifiedOtp} className="btn-verify">Verify Mobile OTP (+10)</button>
                    <button onClick={handleVerifyAadhaar} disabled={userVerifiedAadhaar} className="btn-verify">Verify Aadhaar ID (+30)</button>
                  </div>
                  <p className="trust-caption">High trust score (&gt;60) bypasses the AI spam moderation queue.</p>
                </div>
              </div>

              <div className="card my-reports-card">
                <h3>My Filed Complaints & Verification Loops</h3>
                <p className="sec-desc text-[0.75rem] text-slate-400 mb-2">Once resolved, you have a 7-day window to Confirm or Dispute the resolution.</p>
                <ul id="my-reports-list" className="stack-list">
                  {myReports.length === 0 ? (
                    <li className="muted text-center py-3">You have not submitted any complaints yet.</li>
                  ) : (
                    myReports.map((c, i) => (
                      <li key={i}>
                        <strong>
                          <span>{ISSUE_ICONS[c.issue_type] || "📍"} {c.issue_type} - {c.place_name}</span>
                          <span className={`badge-status ${c.status.toLowerCase().replace(" ", "")}`}>{c.status}</span>
                        </strong>
                        <p>{c.description}</p>
                        <p className="text-[0.72rem] text-slate-400">Filed on: {new Date(c.created_at).toLocaleDateString()}</p>
                        
                        {c.status === "Resolved" && (
                          <div className="verification-loop-actions mt-2 flex gap-1">
                            <button onClick={() => handleVerifyResolution(c.complaint_id, "Confirmed")} className="btn-confirm">Confirm Resolution</button>
                            <button onClick={() => handleVerifyResolution(c.complaint_id, "Disputed")} className="btn-dispute">Dispute Resolution</button>
                          </div>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}

          {activeTab === "governance" && (
            <div id="view-governance" className="panel-view active">
              {/* Official Government Officer Portal Notice */}
              <div className="card role-card" style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(15, 23, 42, 0.95))", border: "1px solid rgba(245, 158, 11, 0.35)", padding: "16px", borderRadius: "12px", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "1px", color: "#f59e0b", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>🛡️</span>
                      <span>Administrative Officer Console</span>
                    </span>
                    <h3 style={{ margin: "4px 0 2px 0", fontSize: "1.05rem", color: "#ffffff", fontWeight: "bold" }}>
                      Government Grievance Command Portal
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8" }}>
                      Administrative officers have a separate, dedicated command site with hierarchy controls, jurisdiction maps, inter-department memos, and budget approvals.
                    </p>
                  </div>
                  <a
                    href="/officer/login"
                    style={{
                      background: "linear-gradient(to right, #f59e0b, #ea580c)",
                      color: "#020617",
                      fontWeight: "bold",
                      fontSize: "0.82rem",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 4px 12px rgba(245, 158, 11, 0.25)"
                    }}
                  >
                    <span>Officer Portal Login</span>
                    <span>→</span>
                  </a>
                </div>
              </div>

              {/* Leaderboard */}
              <div className="card leaderboard-card">
                <h3>Authority Resolution Leaderboard</h3>
                <table className="data-table w-full text-left border-collapse mt-2">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-[0.75rem] uppercase">
                      <th className="py-2">Authority</th>
                      <th className="py-2">Performance</th>
                      <th className="py-2">Resolved</th>
                      <th className="py-2">Disputes</th>
                      <th className="py-2">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {authorities.map((auth, i) => (
                      <tr key={i} className="border-b border-slate-800 text-[0.84rem]">
                        <td className="py-2 font-medium">{auth.name}</td>
                        <td className="py-2 text-[#22d3ee] font-bold">{auth.metrics?.score || 75}%</td>
                        <td className="py-2">{auth.metrics?.resolved_complaints || 0}</td>
                        <td className="py-2 text-rose-400">{auth.metrics?.disputed_complaints || 0}</td>
                        <td className="py-2">{auth.metrics?.open_complaints || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Ward AQI Rankings */}
              <div className="card ranking-card">
                <h3>Ward AQI Performance Rankings</h3>
                <ul id="ward-ranking-list" className="ranking-list flex flex-col gap-2 mt-2 max-h-[220px] overflow-y-auto">
                  {wardRankings.slice(0, 15).map((ward, i) => (
                    <li key={i} className="flex justify-between items-center text-[0.84rem] bg-slate-900 border border-slate-800 rounded p-2">
                      <span>{i + 1}. {ward.name}</span>
                      <strong style={{ color: scoreToColor(ward.area_score) }}>{ward.area_score} AQI</strong>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CSV Export */}
              <div className="card export-card">
                <h3>Civic Data Analytics Portal</h3>
                <p className="text-[0.8rem] text-slate-400 mb-2">Export completed and open logs for public media inspection and analytics.</p>
                <button
                  onClick={() => window.open("/api/complaints/export", "_blank")}
                  className="btn-secondary w-full"
                >
                  📥 Export Immutable Civic Ledger (CSV)
                </button>
              </div>
            </div>
          )}
        </aside>
          </main>
        </div> {/* END app-main */}
      </div> {/* END app-container */}

      {/* Citizen Authentication Modal */}
      {showCitizenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">👤</span>
                <h3 className="text-sm font-bold text-white">Citizen Sign In & Registration</h3>
              </div>
              <button onClick={() => setShowCitizenModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {citizenAuthError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                ⚠️ {citizenAuthError}
              </div>
            )}

            {/* 1-Click Citizen Presets for Instant Testing */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                ⚡ Quick Citizen Test Profiles
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleCitizenAuth("rahul.sharma@example.com", "citizen123")}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-left transition-colors group"
                >
                  <span className="text-xs font-bold text-white block group-hover:text-cyan-300">Rahul Sharma</span>
                  <span className="text-[10px] text-slate-400">Hazratganj, Lucknow</span>
                  <span className="text-[9px] text-emerald-400 block mt-0.5">85 Trust Score</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCitizenAuth("priya.verma@example.com", "citizen123")}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-left transition-colors group"
                >
                  <span className="text-xs font-bold text-white block group-hover:text-cyan-300">Priya Verma</span>
                  <span className="text-[10px] text-slate-400">Naubasta, Kanpur</span>
                  <span className="text-[9px] text-emerald-400 block mt-0.5">90 Trust Score</span>
                </button>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleCitizenAuth(); }} className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  value={citizenEmail}
                  onChange={(e) => setCitizenEmail(e.target.value)}
                  required
                  placeholder="your.email@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  value={citizenPassword}
                  onChange={(e) => setCitizenPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCitizenModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20"
                >
                  Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
