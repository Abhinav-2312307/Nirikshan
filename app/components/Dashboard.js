"use client";

import { useState, useEffect, useRef } from "react";
import L from "leaflet";

import { renderToString } from "react-dom/server";
import { AlertTriangle, Droplets, Lightbulb, Trash2, Construction, Map as MapIcon, TreePine, Home, Store, MapPin, Search, Calendar, Star, CheckCircle, CheckCircle2, ShieldCheck, Activity, BarChart, BarChart3, Settings, ShieldAlert, Crosshair, User, TrendingUp, ChevronRight, Download, X, Menu, ChevronDown, ChevronUp, LayoutDashboard, Shield } from "lucide-react";

// Helper to render icons for Leaflet divIcon HTML strings
const getIconHtml = (IconComponent, color = "currentColor", size = 18) => {
  return renderToString(<IconComponent size={size} color={color} strokeWidth={2.5} />);
};

// Mapping icons for different categories (HTML strings for Leaflet)
const ISSUE_ICONS_HTML = {
  Pothole: getIconHtml(Construction, "var(--warning)"),
  Water: getIconHtml(Droplets, "var(--info)"),
  Streetlight: getIconHtml(Lightbulb, "var(--warning)"),
  Sewer: getIconHtml(Droplets, "var(--neutral)"),
  Garbage: getIconHtml(Trash2, "var(--critical)"),
  Safety: getIconHtml(AlertTriangle, "var(--critical)"),
  Encroachment: getIconHtml(Construction, "var(--warning)")
};

const PLACE_ICONS_HTML = {
  road: getIconHtml(MapIcon),
  park: getIconHtml(TreePine, "var(--success)"),
  home: getIconHtml(Home),
  shop: getIconHtml(Store),
  "public-place": getIconHtml(MapPin),
  location: getIconHtml(MapPin)
};

// Mapping icons for JSX rendering
const ISSUE_ICONS = {
  Pothole: <Construction size={16} />,
  Water: <Droplets size={16} />,
  Streetlight: <Lightbulb size={16} />,
  Sewer: <Droplets size={16} />,
  Garbage: <Trash2 size={16} />,
  Safety: <AlertTriangle size={16} />,
  Encroachment: <Construction size={16} />
};

const PLACE_ICONS = {
  road: <MapIcon size={16} />,
  park: <TreePine size={16} />,
  home: <Home size={16} />,
  shop: <Store size={16} />,
  "public-place": <MapPin size={16} />,
  location: <MapPin size={16} />
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
  const [userId] = useState("demo-citizen-101");
  const [authorityRole, setAuthorityRole] = useState("citizen"); // "citizen" | "KNN" | "KDA" | "JAL"
  const [viewModerationQueue, setViewModerationQueue] = useState(false);
  const [mapTheme, setMapTheme] = useState("dark"); // "dark" | "street"
  const [isLocating, setIsLocating] = useState(false);
  
  // New UX States
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [complaintFilter, setComplaintFilter] = useState("all"); // "all" | "pending" | "resolved" | "critical"
  const [citizenReportFilter, setCitizenReportFilter] = useState("All"); // "All" | "Resolved" | "Pending"
  const [mapZoom, setMapZoom] = useState(13);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const navMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (navMenuRef.current && !navMenuRef.current.contains(event.target)) {
        setIsNavMenuOpen(false);
      }
    }
    if (isNavMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNavMenuOpen]);

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
  
  // Governance Console Phase 4 State & Mock Data
  const [govResolutionPeriod, setGovResolutionPeriod] = useState("30");
  const [selectedAuthorityDetails, setSelectedAuthorityDetails] = useState(null);

  // Phase 5: Intelligence & Polish States
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showInsight, setShowInsight] = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [heatmapPeriod, setHeatmapPeriod] = useState(30); // 7, 30, 90
  const [isPlayingHeatmap, setIsPlayingHeatmap] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts if typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      
      switch (e.key.toLowerCase()) {
        case "/":
          e.preventDefault();
          setShowSearchModal(true);
          break;
        case "escape":
          setShowSearchModal(false);
          setIsReportModalOpen(false);
          setIsReviewFormOpen(false);
          setSelectedAuthorityDetails(null);
          break;
        case "m":
          if (!showSearchModal) setActiveTab("map");
          break;
        case "a":
          if (!showSearchModal && activeTab === "map") setActiveMode("aqi");
          break;
        case "c":
          if (!showSearchModal && activeTab === "map") setActiveMode("heatmap");
          break;
        case "r":
          if (!showSearchModal) setIsReportModalOpen(true);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, showSearchModal]);

  // Heatmap Playback Logic
  useEffect(() => {
    if (!isPlayingHeatmap) return;
    
    const interval = setInterval(() => {
      setHeatmapPeriod(prev => {
        if (prev === 7) return 30;
        if (prev === 30) return 90;
        return 7;
      });
    }, 2000);
    
    return () => clearInterval(interval);
  }, [isPlayingHeatmap]);
  
  const mockResolutionData = {
    "7": { received: 142, resolved: 120, open: 22, trend: "+12%" },
    "30": { received: 840, resolved: 710, open: 130, trend: "+8%" },
    "90": { received: 2450, resolved: 1980, open: 470, trend: "-2%" }
  };
  
  const handleMapNavigate = () => {
    setActiveTab("map");
    setActiveMode("explore");
  };
  
  // Simulated photo upload
  const [uploadedImage, setUploadedImage] = useState(null);

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
        maxZoom: 18
      }).setView([26.4185, 80.305], 13);

      const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap contributors, © CartoDB",
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(map);
      tileLayerRef.current = tiles;

      mapInstance.current = map;

      const markerCluster = L.markerClusterGroup({
        iconCreateFunction: function(cluster) {
          const childCount = cluster.getChildCount();
          let c = ' marker-cluster-';
          if (childCount < 10) c += 'small';
          else if (childCount < 100) c += 'medium';
          else c += 'large';
          
          let pending = 0;
          let resolved = 0;
          cluster.getAllChildMarkers().forEach(m => {
            if (m.options.complaintStatus === 'Resolved') resolved++;
            else pending++;
          });
          
          const title = `${childCount} CIVIC REPORTS&#10;${pending} Pending&#10;${resolved} Resolved`;

          return new L.DivIcon({
            html: `<div title="${title}"><span>${childCount}</span></div>`,
            className: 'marker-cluster' + c,
            iconSize: new L.Point(40, 40)
          });
        }
      });
      map.addLayer(markerCluster);
      clusterLayerRef.current = markerCluster;

      map.on("zoomend", handleZoomEnd);
      map.on("click", async (e) => {
        setSelectedLatlng(e.latlng);
        await resolveAndRenderPlace(e.latlng.lat, e.latlng.lng);
      });

      // Trigger initial load
      refreshAqiLayer("india-states");
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

    let url = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    let attr = "© OpenStreetMap contributors, © CartoDB";

    if (mapTheme === "street") {
      url = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      attr = "© OpenStreetMap contributors";
    }

    const newTiles = L.tileLayer(url, {
      attribution: attr,
      subdomains: mapTheme === "dark" ? "abcd" : "abc",
      maxZoom: 20
    }).addTo(map);

    tileLayerRef.current = newTiles;
  }, [mapTheme]);

  // Update map when mode or filter changes
  useEffect(() => {
    if (mapInstance.current) {
      updateMapVisuals();
      requestAnimationFrame(() => {
        if (mapInstance.current) mapInstance.current.invalidateSize();
      });
    }
  }, [activeMode, complaintFilter]);

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
          html: `<div class="place-pin">${PLACE_ICONS_HTML[feature.properties.type] || getIconHtml(MapPin)}</div>`,
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

  const refreshAqiLayer = async (level = null) => {
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

    let data;
    try {
      data = await api(`/api/areas?level=${level}`);
    } catch (err) {
      console.error("AQI Layer fetch failed:", err);
      return;
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

        childLayer.bindTooltip(`<strong>${feature.properties.name}</strong><br>AQI Score: ${feature.properties.area_score} (${feature.properties.area_status || "Unknown"})`, {
          sticky: true
        });

        childLayer.on("mouseover", (e) => {
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
            html: `<div class="place-pin" style="border-color: var(--primary);">${getIconHtml(MapPin, "var(--primary)")}</div>`,
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

  const handleZoomEnd = async () => {
    if (mapInstance.current) {
      setMapZoom(mapInstance.current.getZoom());
    }
    if (activeModeRef.current !== "aqi" && activeModeRef.current !== "heatmap") return;
    await refreshAqiLayer();
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
        
        if (complaintFilter === "pending" && c.status !== "Submitted" && c.status !== "Verified" && c.status !== "Assigned" && c.status !== "In Progress") return;
        if (complaintFilter === "resolved" && c.status !== "Resolved") return;
        if (complaintFilter === "critical" && c.severity < 3) return;

        const isEscalatedStr = c.escalated ? ` | <span style="color: #f43f5e; font-weight:700;">ESCALATED (No update > 30d)</span>` : "";
        const isDisputedStr = c.verification_status === "Disputed" ? ` | <span style="color: #f43f5e; font-weight:700;">DISPUTED RESOLUTION</span>` : "";
        let duplicateAlert = "";
        if (c.is_duplicate) {
          duplicateAlert = `<br><span style="color: #fbbf24; font-size: 0.78rem; font-weight:600;"><span style="display:inline-block; vertical-align:middle; margin-right:4px;">${getIconHtml(AlertTriangle, "#fbbf24", 14)}</span> Linked as duplicate of complaint #${c.duplicate_of.slice(0, 8)}</span>`;
        }

        let routeText = `Routed Authority: ${c.authority} (${c.department})`;
        if (c.disputed_jurisdiction) {
          routeText = `<strong style="color:#60a5fa;">Overlapping Jurisdiction Assigned:</strong><ul style="margin-left: 14px; margin-top: 3px;">` + 
                      c.assigned_authorities.map(a => `<li>${a.name} (${a.department})</li>`).join("") + `</ul>`;
        }

        const icon = L.divIcon({
          className: "",
          html: `<div class="place-pin" style="border-color: ${c.status === 'Resolved' ? 'var(--success)' : 'var(--warning)'}" title="${c.issue_type} - ${c.status}">${ISSUE_ICONS_HTML[c.issue_type] || getIconHtml(MapPin)}</div>`,
          iconSize: [26, 26]
        });

        const marker = L.marker([c.latitude, c.longitude], { icon, complaintStatus: c.status });
        marker.bindPopup(`
          <div style="background: rgba(18, 14, 26, 0.95); backdrop-filter: blur(16px); color: #e2e8f0; font-family: inherit; padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); width: max-content; min-width: 220px; max-width: 280px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <h4 style="margin: 0; font-size: 0.9rem; color: #fff; display: flex; align-items: center; gap: 8px; font-weight: 600;">
                <span style="color: var(--brand); display: flex; align-items: center;">${ISSUE_ICONS_HTML[c.issue_type] || getIconHtml(MapPin)}</span> 
                ${c.issue_type}
              </h4>
              <span style="font-size: 0.65rem; padding: 3px 8px; border-radius: 99px; background: ${c.status === 'Resolved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${c.status === 'Resolved' ? '#34d399' : '#fbbf24'}; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; border: 1px solid ${c.status === 'Resolved' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'};">${c.status}</span>
            </div>
            <p style="margin: 0 0 12px 0; font-size: 0.8rem; color: #cbd5e1; line-height: 1.5;">${c.description}</p>
            <div style="font-size: 0.75rem; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
              ${routeText ? `<div style="margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">📍 ${routeText}</div>` : ''}
              ${duplicateAlert ? `<div style="margin-bottom: 4px; color: #fb7185;">${duplicateAlert}</div>` : ''}
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                <span style="font-size: 0.65rem; color: #64748b; font-family: monospace;">ID: ${c.complaint_id}</span>
                <button onclick="document.dispatchEvent(new CustomEvent('inspectComplaint', {detail: '${c.complaint_id}'}))" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; transition: all 0.2s;">Inspect</button>
              </div>
            </div>
          </div>
        `, { className: 'dark-civic-popup', closeButton: false });
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
          html: `<div class="place-pin" style="border-color: var(--critical);">${getIconHtml(MapPin, "var(--critical)")}</div>`,
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
      await resolveAndRenderPlace(selectedLatlng.lat, selectedLatlng.lng);
      await refreshMetrics();
      await refreshAqiLayer();
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
        alert("Your complaint was routed to the Human Moderation Queue. Reason: Description flagged by AI NLP checks or trust score remains below threshold.");
      } else if (response.is_duplicate) {
        alert("Similar issue reported recently in this area. AI flagged this complaint as duplicate and linked it to the existing ticket.");
      } else {
        alert("Complaint filed successfully. Assigned routing transparently logged.");
      }

      await resolveAndRenderPlace(selectedLatlng.lat, selectedLatlng.lng);
      await refreshMetrics();
      await refreshComplaints();
      await refreshAqiLayer();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVerifyOtp = () => {
    setUserVerifiedOtp(true);
    setUserTrustScore(prev => Math.min(100, prev + 10));
    alert("Mobile OTP verified successfully! Trust Score increased by 10.");
  };

  const handleVerifyAadhaar = () => {
    setUserVerifiedAadhaar(true);
    setUserTrustScore(prev => Math.min(100, prev + 30));
    alert("Aadhaar identity verified successfully! Trust Score increased by 30.");
  };

  const handleFlagComplaint = async (complaintId) => {
    try {
      const res = await api(`/api/complaints/${encodeURIComponent(complaintId)}/flag`, { method: "POST" });
      alert(`Flagged. Current flags: ${res.flags_count}. Status: ${res.status}`);
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
      loadMyReports();
      refreshMetrics();
      refreshComplaints();
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
      loadGovernanceData();
      refreshMetrics();
      refreshComplaints();
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

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
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
    setShowSearchModal(false);
    setActiveTab("map");
    const map = mapInstance.current;
    if (!map) return;

    const geom = feature.geometry;
    let coords = [];
    if (geom.type === "Point") coords = [geom.coordinates[1], geom.coordinates[0]];
    else if (geom.type === "LineString") coords = [geom.coordinates[0][1], geom.coordinates[0][0]];
    else if (geom.type === "Polygon") coords = [geom.coordinates[0][0][1], geom.coordinates[0][0][0]];

    map.flyTo(coords, 16, { duration: 0.8 });
    setSelectedLatlng({ lat: coords[0], lng: coords[1] });
    await resolveAndRenderPlace(coords[0], coords[1]);
  };

  const scoreToColor = (score) => {
    if (score >= 81) return "#10b981"; // excellent - green
    if (score >= 61) return "#84cc16"; // good - lime
    if (score >= 31) return "#fbbf24"; // moderate - amber
    return "#f43f5e"; // critical - rose
  };

  // Citizen Dashboard Derivations
  const totalCitizenReports = myReports.length;
  const resolvedCitizenReports = myReports.filter(c => c.status === "Resolved" || c.status === "Closed").length;
  const inProgressCitizenReports = myReports.filter(c => c.status === "Assigned" || c.status === "In Progress").length;
  const awaitingConfirmationReports = myReports.filter(c => c.status === "Resolved").length;
  const civicImpactScore = resolvedCitizenReports;

  const filteredMyReports = myReports.filter(c => {
    if (citizenReportFilter === "All") return true;
    if (citizenReportFilter === "Resolved") return c.status === "Resolved" || c.status === "Closed";
    if (citizenReportFilter === "Pending") return c.status !== "Resolved" && c.status !== "Closed";
    return true;
  });

  return (
    <>
      <header className="navbar">
        <div className="brand">
          <div className="brand-dot"></div>
          <div>
            <h1>Nirikshan Ledger</h1>
            <p>Next.js & MongoDB Civic Quality Mapping</p>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          {activeTab === "map" && (
            <div className="mode-tabs flex items-center" style={{ scale: "0.95" }}>
              <button className={`mode-tab ${activeMode === "explore" ? "active" : ""}`} onClick={() => setActiveMode("explore")}>Complaints</button>
              <button className={`mode-tab ${activeMode === "aqi" ? "active" : ""}`} onClick={() => setActiveMode("aqi")}>AQI</button>
              <button className={`mode-tab ${activeMode === "heatmap" ? "active" : ""}`} onClick={() => setActiveMode("heatmap")}>Heatmap</button>
              
              <div className="w-px h-6 bg-slate-700/50 mx-1"></div>
              
              <button 
                className={`flex items-center justify-center rounded-full w-9 h-9 mx-1 mr-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${isLocating ? "text-brand" : ""}`} 
                onClick={handleLocateMe} 
                title="Locate Me"
              >
                {isLocating ? <span className="spinner"></span> : <Crosshair size={18} />}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Navigation Drawer & Backdrop */}
        <div ref={navMenuRef}>
          {/* Backdrop */}
          <div 
            className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isNavMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            onClick={() => setIsNavMenuOpen(false)}
          ></div>

          {/* Drawer */}
          <div 
            className={`fixed top-0 right-0 bottom-0 w-[280px] z-50 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] transform ${isNavMenuOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"}`}
            style={{ background: "var(--panel)", borderLeft: "1px solid var(--line)" }}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-white font-semibold tracking-wide text-lg">Menu</h2>
              <button 
                onClick={() => setIsNavMenuOpen(false)}
                className="p-2 -mr-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {/* Main Navigation */}
              <div className="flex flex-col py-3 px-3 gap-2">
                <span className="px-2 py-1 text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Main</span>
                
                <button 
                  className="text-left px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all duration-200 flex items-center gap-4 border active:scale-[0.98]"
                  style={{
                    background: activeTab === "map" ? "rgba(139, 92, 246, 0.12)" : "rgba(255, 255, 255, 0.02)",
                    borderColor: activeTab === "map" ? "rgba(139, 92, 246, 0.3)" : "rgba(255, 255, 255, 0.06)",
                    boxShadow: activeTab === "map" ? "0 0 12px rgba(139, 92, 246, 0.15)" : "none",
                    color: activeTab === "map" ? "var(--brand)" : "#cbd5e1"
                  }}
                  onMouseEnter={(e) => { if (activeTab !== "map") { e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"; } }}
                  onMouseLeave={(e) => { if (activeTab !== "map") { e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)"; e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)"; } }}
                  onClick={() => { setActiveTab("map"); setIsNavMenuOpen(false); }}
                >
                  <MapIcon size={18} className={activeTab === "map" ? "text-brand" : "text-slate-400"} />
                  Map Explorer
                </button>
                
                <button 
                  className="text-left px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all duration-200 flex items-center gap-4 border active:scale-[0.98]"
                  style={{
                    background: activeTab === "citizen" ? "rgba(139, 92, 246, 0.12)" : "rgba(255, 255, 255, 0.02)",
                    borderColor: activeTab === "citizen" ? "rgba(139, 92, 246, 0.3)" : "rgba(255, 255, 255, 0.06)",
                    boxShadow: activeTab === "citizen" ? "0 0 12px rgba(139, 92, 246, 0.15)" : "none",
                    color: activeTab === "citizen" ? "var(--brand)" : "#cbd5e1"
                  }}
                  onMouseEnter={(e) => { if (activeTab !== "citizen") { e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"; } }}
                  onMouseLeave={(e) => { if (activeTab !== "citizen") { e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)"; e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)"; } }}
                  onClick={() => { setActiveTab("citizen"); setIsNavMenuOpen(false); }}
                >
                  <LayoutDashboard size={18} className={activeTab === "citizen" ? "text-brand" : "text-slate-400"} />
                  Citizen Dashboard
                </button>
                
                <button 
                  className="text-left px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all duration-200 flex items-center gap-4 border active:scale-[0.98]"
                  style={{
                    background: activeTab === "governance" ? "rgba(139, 92, 246, 0.12)" : "rgba(255, 255, 255, 0.02)",
                    borderColor: activeTab === "governance" ? "rgba(139, 92, 246, 0.3)" : "rgba(255, 255, 255, 0.06)",
                    boxShadow: activeTab === "governance" ? "0 0 12px rgba(139, 92, 246, 0.15)" : "none",
                    color: activeTab === "governance" ? "var(--brand)" : "#cbd5e1"
                  }}
                  onMouseEnter={(e) => { if (activeTab !== "governance") { e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"; } }}
                  onMouseLeave={(e) => { if (activeTab !== "governance") { e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)"; e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)"; } }}
                  onClick={() => { setActiveTab("governance"); setIsNavMenuOpen(false); }}
                >
                  <Shield size={18} className={activeTab === "governance" ? "text-brand" : "text-slate-400"} />
                  Governance Console
                </button>
              </div>

              {/* Actions */}
              <div className="flex flex-col py-3 px-3 gap-2">
                <span className="px-2 py-1 text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Report</span>
                
                <button 
                  className="w-full flex items-center gap-3 text-[15px] font-semibold transition-all duration-200 rounded-xl border active:scale-[0.98]"
                  style={{ 
                    padding: "14px 16px", 
                    background: "rgba(139, 92, 246, 0.15)", 
                    color: "var(--brand)", 
                    borderColor: "rgba(139, 92, 246, 0.4)",
                    boxShadow: "0 0 16px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)"
                  }} 
                  onClick={() => { setIsReportModalOpen(true); setIsNavMenuOpen(false); }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139, 92, 246, 0.25)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(139, 92, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(139, 92, 246, 0.15)"; e.currentTarget.style.boxShadow = "0 0 16px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)"; }}
                >
                  <AlertTriangle size={18} /> 
                  <span>Report an Issue</span>
                </button>
              </div>

              {/* Utilities */}
              <div className="flex flex-col py-3 px-3 gap-2">
                <span className="px-2 py-1 text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Utilities</span>
                
                <button 
                  className="w-full flex items-center justify-between text-[15px] font-medium transition-all duration-200 rounded-xl border active:scale-[0.98]"
                  style={{
                    padding: "12px 16px",
                    background: isStatsExpanded ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.02)",
                    borderColor: isStatsExpanded ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.06)",
                    color: "#cbd5e1"
                  }}
                  onMouseEnter={(e) => { if (!isStatsExpanded) { e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"; } }}
                  onMouseLeave={(e) => { if (!isStatsExpanded) { e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)"; e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)"; } }}
                  onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                >
                  <div className="flex items-center gap-4">
                    <Activity size={18} className={isStatsExpanded ? "text-white" : "text-slate-400"} />
                    <div className="flex flex-col items-start">
                      <span className={isStatsExpanded ? "text-white" : ""}>Map Statistics</span>
                      {!isStatsExpanded && (
                        <span className="text-[11px] text-slate-500 font-normal mt-0.5">{summary.total} reports · {summary.pending} pending</span>
                      )}
                    </div>
                  </div>
                  {isStatsExpanded ? <ChevronUp size={16} className="text-white" /> : <ChevronDown size={16} className="text-slate-500" />}
                </button>
                
                {isStatsExpanded && (
                  <div className="mt-1 p-2 grid grid-cols-2 gap-2 rounded-xl border" style={{ background: "rgba(0,0,0,0.2)", borderColor: "rgba(255,255,255,0.05)" }}>
                    <button onClick={() => setComplaintFilter("all")} className={`flex flex-col text-left p-3.5 rounded-lg transition-all duration-200 border active:scale-[0.95]`}
                      style={{
                        background: complaintFilter === "all" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.02)",
                        borderColor: complaintFilter === "all" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)"
                      }}
                      onMouseEnter={(e) => { if (complaintFilter !== "all") { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; } }}
                      onMouseLeave={(e) => { if (complaintFilter !== "all") { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; } }}
                    >
                      <span className="text-2xl font-bold text-white leading-none">{summary.total}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">Total</span>
                    </button>
                    <button onClick={() => setComplaintFilter("pending")} className={`flex flex-col text-left p-3.5 rounded-lg transition-all duration-200 border active:scale-[0.95]`}
                      style={{
                        background: complaintFilter === "pending" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.02)",
                        borderColor: complaintFilter === "pending" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)"
                      }}
                      onMouseEnter={(e) => { if (complaintFilter !== "pending") { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; } }}
                      onMouseLeave={(e) => { if (complaintFilter !== "pending") { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; } }}
                    >
                      <span className="text-2xl font-bold text-white leading-none">{summary.pending}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">Pending</span>
                    </button>
                    <button onClick={() => setComplaintFilter("resolved")} className={`flex flex-col text-left p-3.5 rounded-lg transition-all duration-200 border active:scale-[0.95]`}
                      style={{
                        background: complaintFilter === "resolved" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.02)",
                        borderColor: complaintFilter === "resolved" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)"
                      }}
                      onMouseEnter={(e) => { if (complaintFilter !== "resolved") { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; } }}
                      onMouseLeave={(e) => { if (complaintFilter !== "resolved") { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; } }}
                    >
                      <span className="text-2xl font-bold text-white leading-none">{summary.resolved}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">Resolved</span>
                    </button>
                    <button onClick={() => setComplaintFilter("critical")} className={`flex flex-col text-left p-3.5 rounded-lg transition-all duration-200 border active:scale-[0.95]`}
                      style={{
                        background: complaintFilter === "critical" ? "rgba(139, 92, 246, 0.15)" : "rgba(255,255,255,0.02)",
                        borderColor: complaintFilter === "critical" ? "rgba(139, 92, 246, 0.4)" : "rgba(255,255,255,0.05)",
                        boxShadow: complaintFilter === "critical" ? "0 0 12px rgba(139, 92, 246, 0.15)" : "none"
                      }}
                      onMouseEnter={(e) => { if (complaintFilter !== "critical") { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; } }}
                      onMouseLeave={(e) => { if (complaintFilter !== "critical") { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; } }}
                    >
                      <span className="text-2xl font-bold text-brand leading-none">{summary.highPriority}</span>
                      <span className="text-[10px] text-brand/70 font-bold uppercase tracking-wider mt-2">Critical</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Hamburger Button (in Header) */}
        <div className="flex items-center ml-2 relative z-50">
          <button 
            onClick={() => setIsNavMenuOpen(!isNavMenuOpen)}
            className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${isNavMenuOpen ? "opacity-0 pointer-events-none scale-90" : "opacity-100 scale-100 hover:text-white"}`}
            style={{ 
              background: "var(--panel)", 
              border: "1px solid var(--line)", 
              color: "var(--muted)", 
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)" 
            }}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      <main className={`layout tab-${activeTab} ${!selectedPlace && activeTab === 'map' ? 'map-full-focus' : ''}`}>
        <section className="map-panel">
          
          <div className="map-top-bar" style={{ position: "absolute", top: "16px", left: "16px", zIndex: 800, display: "flex", gap: "12px", alignItems: "center" }}>
            <div className="breadcrumb-container" style={{ background: "rgba(9, 7, 15, 0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "8px 14px", color: "var(--muted)", fontSize: "0.8rem", fontWeight: 600, display: "flex", gap: "8px", alignItems: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
              <span className="cursor-pointer hover:text-white transition-colors">India</span> <ChevronRight size={12} className="opacity-50" /> 
              <span className="cursor-pointer hover:text-white transition-colors">Uttar Pradesh</span> 
              {mapZoom > 6 && <><ChevronRight size={12} className="opacity-50" /> <span className="cursor-pointer hover:text-white transition-colors">Kanpur Nagar</span></>}
              {mapZoom > 11 && <><ChevronRight size={12} className="opacity-50" /> <span className="cursor-pointer hover:text-white transition-colors">Ward</span></>}
              {mapZoom > 13 && <><ChevronRight size={12} className="opacity-50" /> <span className="text-white">Locality</span></>}
            </div>

            <button className="search-trigger-btn" onClick={() => setShowSearchModal(true)} style={{ width: "280px", background: "rgba(9, 7, 15, 0.9)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", borderRadius: "8px", height: "100%" }}>
              <Search size={14} className="text-slate-400" />
              <span>Search location or issue...</span>
              <kbd className="ml-auto hidden md:inline-flex bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-xs"> / </kbd>
            </button>
          </div>

          {showInsight && (
            <div className="insight-panel" style={{ position: "absolute", top: "64px", left: "16px", zIndex: 800, width: "320px", background: "rgba(18,14,26,0.85)", backdropFilter: "blur(20px)", border: "1px solid var(--brand)", borderRadius: "12px", padding: "16px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
              <div className="flex justify-between items-start mb-3">
                <h4 className="flex items-center gap-2 text-brand font-bold text-sm tracking-wide uppercase"><Lightbulb size={16} className="text-brand" fill="currentColor" /> Nirikshan Insight</h4>
                <button onClick={() => setShowInsight(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-4">
                {activeMode === "explore" ? "Complaint density is highest around the central corridor. Road-related complaints account for most unresolved reports." 
                 : activeMode === "aqi" ? "Most wards are currently in the acceptable range. Two areas show elevated AQI compared with the surrounding wards." 
                 : `Kanpur Nagar has 18% more road complaints than last month. 3 critical complaints have remained unresolved for more than ${heatmapPeriod} days.`}
              </p>
              <div className="flex gap-2">
                <button className="flex-1 btn-primary text-xs py-1.5" onClick={() => { setShowInsight(false); setActiveTab("governance"); }}>Investigate</button>
                <button className="flex-1 btn-secondary text-xs py-1.5" onClick={() => setShowInsight(false)}>Dismiss</button>
              </div>
            </div>
          )}




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

          <div ref={mapRef} id="map"></div>
        </section>

        {(activeTab !== "map" || selectedPlace) && (
          <aside className="sheet">
            {activeTab === "map" && selectedPlace && (
              <div id="view-map" className="panel-view active">
                  <div className="card place-card" id="place-summary-card" style={{ position: "relative" }}>
                    <button 
                      onClick={() => setSelectedPlace(null)} 
                      style={{ position: "absolute", top: "12px", right: "12px", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: "4px" }}
                      title="Close"
                    >
                      <X size={16} />
                    </button>
                    <p id="place-type" className="place-type" style={{ paddingRight: "24px" }}>
                      {selectedPlace.place.properties.type} {selectedPlace.is_virtual ? "(pin drop)" : ""}
                    </p>
                    <h2 id="place-name" style={{ paddingRight: "24px" }}>{selectedPlace.place.properties.name}</h2>
                    
                    <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                      <div><label>Score</label><strong>{selectedPlace.metrics.avg_rating ? `${(selectedPlace.metrics.avg_rating * 20).toFixed(0)}` : "NA"}</strong></div>
                      <div><label>Reports</label><strong>{selectedPlace.metrics.complaint_count}</strong></div>
                      <div><label>Pending</label><strong>{selectedPlace.metrics.pending_complaints}</strong></div>
                      <div><label>Resolved</label><strong style={{ color: "var(--green)" }}>{selectedPlace.metrics.complaint_count - selectedPlace.metrics.pending_complaints}</strong></div>
                    </div>
                    
                    {selectedPlace.place.properties.type !== "state" && (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", fontWeight: "600" }}>Quality Breakdown</p>
                        <div style={{ display: "flex", gap: "12px", fontSize: "0.8rem", flexWrap: "wrap" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><MapIcon size={14} color="var(--primary)" /> Road: <strong style={{ color: "#fff" }}>Good</strong></span>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Trash2 size={14} color="var(--critical)" /> Cleanliness: <strong style={{ color: "#fff" }}>Poor</strong></span>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Lightbulb size={14} color="var(--warning)" /> Lighting: <strong style={{ color: "#fff" }}>Fair</strong></span>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Droplets size={14} color="var(--info)" /> Water: <strong style={{ color: "#fff" }}>Good</strong></span>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isReviewFormOpen ? (
                    <button className="btn-secondary" style={{ width: "100%", marginBottom: "14px", padding: "14px", border: "1px dashed rgba(255,255,255,0.15)" }} onClick={() => setIsReviewFormOpen(true)}>
                      <Star size={16} /> Rate This Place
                    </button>
                  ) : (
                    <div className="card form-card" id="rating-submission-card" style={{ marginBottom: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                        <h3 style={{ margin: 0 }}>Rate Quality & Review</h3>
                        <button onClick={() => setIsReviewFormOpen(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.2rem", padding: "0 8px" }}>×</button>
                      </div>
                      <form id="review-form" onSubmit={onSubmitReview}>
                        <div className="form-group">
                          <label>Quality Grade
                            <select name="rating" required>
                              <option value="5">★★★★★ Excellent (Well-maintained)</option>
                              <option value="4">★★★★☆ Good (Acceptable)</option>
                              <option value="3">★★★☆☆ Moderate</option>
                              <option value="2">★★☆☆☆ Poor</option>
                              <option value="1">★☆☆☆☆ Critical (Damaged/Broken)</option>
                            </select>
                          </label>
                        </div>
                        <div className="form-group">
                          <label>Feedback Comment
                            <textarea name="comment" rows="2" maxLength="260" placeholder="E.g. Cleanliness, water logging, lighting, road condition..." required></textarea>
                          </label>
                        </div>
                        <button type="submit" className="btn-primary">Post Review</button>
                      </form>
                    </div>
                  )}

                  <div className="card list-card" id="place-reviews-list-card">
                    <h3>Recent Location Reviews</h3>
                    <ul id="review-list" className="stack-list">
                      {reviews.length === 0 ? (
                        <li className="muted text-center py-3">No reviews registered for this place yet.</li>
                      ) : (
                        reviews.slice(0, 3).map((r, i) => (
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
                    <h3>Recent Complaints</h3>
                    <ul id="complaint-list" className="stack-list">
                      {placeComplaints.length === 0 ? (
                        <li className="muted text-center py-3">No complaints reported for this place yet.</li>
                      ) : (
                        placeComplaints.slice(0, 3).map((c, i) => (
                          <li key={i} className={c.escalated ? "escalated-pulse" : ""}>
                            <strong>
                              <span><span style={{display: 'inline-flex', verticalAlign: 'middle', marginRight: '6px'}}>{ISSUE_ICONS[c.issue_type] || <MapPin size={16} />}</span> {c.issue_type}</span>
                              <span className={`badge-status ${c.status.toLowerCase().replace(" ", "")}`}>{c.status}</span>
                            </strong>
                            <p>{c.description}</p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
              </div>
            )}
            {/* Report Issue Modal */}
            {isReportModalOpen && (
              <div className="report-modal-overlay" onClick={(e) => { if (e.target.className === 'report-modal-overlay') setIsReportModalOpen(false) }}>
                <div className="card form-card report-modal-content">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <h3 style={{ margin: 0 }}>Submit New Civic Complaint</h3>
                    <button onClick={() => setIsReportModalOpen(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.4rem", padding: "0 8px" }}>×</button>
                  </div>
                  <div className="alert-info" style={{ display: "flex", alignItems: "center" }}>
                    <ShieldCheck size={16} color="var(--success)" style={{ marginRight: "8px" }} /> GPS and Timestamp attached. EXIF metadata will be stripped and faces automatically blurred.
                  </div>
                  
                  <form id="complaint-form" onSubmit={(e) => { onSubmitComplaint(e); setIsReportModalOpen(false); }}>
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
                              <span className="preview-badge"><ShieldCheck size={14} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} /> Face Blurred</span>
                            </div>
                          )}
                          <button type="button" onClick={handlePhotoUploadSimulation} className="btn-secondary">Select Issue Photo</button>
                        </div>
                      </label>
                    </div>

                    <button type="submit" className="btn-primary" style={{ marginTop: "10px" }}>File Complaint</button>
                  </form>
                </div>
              </div>
            )}
          {activeTab === "citizen" && (
            <div id="view-citizen" className="panel-view active citizen-dashboard-layout">
              {/* TOP OVERVIEW */}
              <section className="citizen-overview">
                <h3 className="section-title">Your Civic Activity</h3>
                <div className="overview-metrics">
                  <div className="overview-metric-card">
                    <span className="metric-label">Total Reports</span>
                    <strong className="metric-value">{totalCitizenReports}</strong>
                  </div>
                  <div className="overview-metric-card">
                    <span className="metric-label text-emerald-400">Resolved</span>
                    <strong className="metric-value text-emerald-400">{resolvedCitizenReports}</strong>
                  </div>
                  <div className="overview-metric-card">
                    <span className="metric-label text-amber-400">In Progress</span>
                    <strong className="metric-value text-amber-400">{inProgressCitizenReports}</strong>
                  </div>
                  <div className="overview-metric-card">
                    <span className="metric-label text-purple-400">Awaiting Confirmation</span>
                    <strong className="metric-value text-purple-400">{awaitingConfirmationReports}</strong>
                  </div>
                </div>
              </section>

              <div className="citizen-columns">
                {/* LEFT COLUMN */}
                <div className="citizen-left-col">
                  {/* Left column content begins directly with My Active Reports */}

                  {/* My Active Reports List */}
                  <div className="card my-reports-card">
                    <div className="reports-header-flex">
                      <h3>My Active Reports</h3>
                      <div className="compact-filters">
                        <button className={`filter-btn ${citizenReportFilter === 'All' ? 'active' : ''}`} onClick={() => setCitizenReportFilter('All')}>All</button>
                        <button className={`filter-btn ${citizenReportFilter === 'Pending' ? 'active' : ''}`} onClick={() => setCitizenReportFilter('Pending')}>Pending</button>
                        <button className={`filter-btn ${citizenReportFilter === 'Resolved' ? 'active' : ''}`} onClick={() => setCitizenReportFilter('Resolved')}>Resolved</button>
                      </div>
                    </div>
                    
                    <ul id="my-reports-list" className="stack-list mt-4">
                      {filteredMyReports.length === 0 ? (
                        <li className="empty-state-card text-center py-8 border-dashed border-slate-700 bg-transparent">
                          <Activity size={32} color="var(--muted)" style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                          <p>No active reports matching filter "{citizenReportFilter}".</p>
                        </li>
                      ) : (
                        filteredMyReports.map((c, i) => (
                          <li key={i} className="report-item p-4">
                            <div className="report-item-header mb-1">
                              <strong>
                                <span><span style={{display: 'inline-flex', verticalAlign: 'middle', marginRight: '6px'}}>{ISSUE_ICONS[c.issue_type] || <MapPin size={16} />}</span> {c.issue_type} - {c.place_name}</span>
                                <span className={`badge-status ${c.status.toLowerCase().replace(" ", "")}`}>{c.status}</span>
                              </strong>
                              <div className="flex justify-between items-center mt-1">
                                <p className="text-[0.72rem] text-slate-400">{new Date(c.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <p className="report-desc text-[0.84rem] text-slate-300 mt-2">{c.description}</p>
                            
                            {/* Civic Timeline */}
                            <div className="civic-timeline mt-4">
                               <div className={`timeline-step ${c.status !== 'Moderation' ? 'completed' : 'active'}`}>Submitted</div>
                               <div className={`timeline-connector ${['Assigned', 'In Progress', 'Resolved', 'Closed'].includes(c.status) ? 'completed' : ''}`}></div>
                               <div className={`timeline-step ${['Assigned', 'In Progress', 'Resolved', 'Closed'].includes(c.status) ? 'completed' : ''}`}>Assigned</div>
                               <div className={`timeline-connector ${['In Progress', 'Resolved', 'Closed'].includes(c.status) ? 'completed' : ''}`}></div>
                               <div className={`timeline-step ${['In Progress', 'Resolved', 'Closed'].includes(c.status) ? 'completed' : ''}`}>In Progress</div>
                               <div className={`timeline-connector ${['Resolved', 'Closed'].includes(c.status) ? 'completed' : ''}`}></div>
                               <div className={`timeline-step ${['Resolved', 'Closed'].includes(c.status) ? 'completed' : ''}`}>Resolved</div>
                               <div className={`timeline-connector ${['Closed'].includes(c.status) ? 'completed' : ''}`}></div>
                               <div className={`timeline-step ${['Closed'].includes(c.status) ? 'completed' : ''}`}>Verified</div>
                            </div>

                            {c.status === "Resolved" && (
                              <div className="verification-loop-box mt-4 p-3 rounded bg-purple-900/15 border border-purple-500/20">
                                <p className="text-[0.75rem] text-purple-300 mb-2 font-medium">Authorities marked this resolved. You have a 7-day window to Confirm or Dispute the resolution.</p>
                                <div className="flex gap-2">
                                  <button onClick={() => handleVerifyResolution(c.complaint_id, "Confirmed")} className="btn-confirm">Confirm Resolution</button>
                                  <button onClick={() => handleVerifyResolution(c.complaint_id, "Disputed")} className="btn-dispute">Dispute Resolution</button>
                                </div>
                              </div>
                            )}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="citizen-right-col">
                  {/* Citizen Verification Card */}
                  <div className="card profile-card">
                    <div className="profile-header">
                      <div className="avatar"><User size={24} /></div>
                      <div>
                        <h3>Citizen Identity</h3>
                        <p>Demo User Profile</p>
                      </div>
                    </div>
                    
                    <div className="trust-score-widget mt-4">
                      <div className="score-header">
                        <span>Civic Trust Score</span>
                        <strong id="citizen-trust-score">{userTrustScore}/100</strong>
                      </div>
                      
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${userTrustScore}%` }}></div>
                      </div>

                      <div className="trust-status-flags mt-3">
                        <span className={`status-chip ${userVerifiedOtp ? "verified" : "unverified"}`}>
                          {userVerifiedOtp ? <><CheckCircle2 size={14} /> OTP Verified</> : "OTP Unverified"}
                        </span>
                        <span className={`status-chip ${userVerifiedAadhaar ? "verified" : "unverified"}`}>
                          {userVerifiedAadhaar ? <><CheckCircle2 size={14} /> Aadhaar Verified</> : "Aadhaar Unverified"}
                        </span>
                      </div>

                      <div className="verification-actions mt-3">
                        <button onClick={handleVerifyOtp} disabled={userVerifiedOtp} className="btn-verify flex flex-col items-center py-2"><span className="text-[0.65rem] opacity-70 mb-1">Mobile OTP</span> <strong>+10 Trust</strong></button>
                        <button onClick={handleVerifyAadhaar} disabled={userVerifiedAadhaar} className="btn-verify flex flex-col items-center py-2"><span className="text-[0.65rem] opacity-70 mb-1">Aadhaar ID</span> <strong>+30 Trust</strong></button>
                      </div>
                      
                      <div className="mt-3 p-2 bg-emerald-900/10 border border-emerald-500/20 rounded-md">
                        <p className="text-[0.7rem] text-emerald-400 flex items-start gap-1 leading-tight">
                          <ShieldCheck size={14} style={{flexShrink: 0, marginTop: "1px"}} /> 
                          Verification directly routes your reports to authorities, bypassing AI moderation queues.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Civic Impact Card */}
                  <div className="card impact-card bg-gradient-to-br from-[#120e1a] to-[#1e142e] border-purple-500/30">
                    <h3 className="flex items-center gap-2 text-purple-200 m-0"><Star size={18} className="text-purple-400" /> Your Civic Impact</h3>
                    <div className="mt-4 text-center py-2">
                      <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-2">
                        {civicImpactScore}
                      </div>
                      <p className="text-[0.85rem] text-purple-200/70 font-medium">Issues resolved because of you</p>
                    </div>
                    <p className="text-[0.7rem] text-slate-400 text-center mt-3 pt-3 border-t border-purple-500/10">Thank you for making your city better.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "governance" && (
            <div id="view-governance" className="panel-view active governance-dashboard-layout">
              {/* TOP KPI BAR */}
              <div className="gov-kpi-bar">
                <div className="gov-kpi-card">
                  <span className="kpi-label">Total Reports</span>
                  <strong className="kpi-value">{summary.total}</strong>
                  <span className="kpi-trend positive"><TrendingUp size={12}/> Increasing (+8%)</span>
                </div>
                <div className="gov-kpi-card">
                  <span className="kpi-label text-amber-400">Open Reports</span>
                  <strong className="kpi-value text-amber-400">{summary.pending}</strong>
                  <span className="kpi-trend negative"><TrendingUp size={12}/> Worsening (+2%)</span>
                </div>
                <div className="gov-kpi-card">
                  <span className="kpi-label text-emerald-400">Resolved Reports</span>
                  <strong className="kpi-value text-emerald-400">{summary.resolved}</strong>
                  <span className="kpi-trend positive"><TrendingUp size={12}/> Improving (+12%)</span>
                </div>
                <div className="gov-kpi-card">
                  <span className="kpi-label text-[#22d3ee]">Resolution Rate</span>
                  <strong className="kpi-value text-[#22d3ee]">{summary.total > 0 ? ((summary.resolved / summary.total) * 100).toFixed(1) : 0}%</strong>
                  <span className="kpi-trend positive"><TrendingUp size={12}/> Improving (+4%)</span>
                </div>
              </div>

              {/* JURISDICTION & ATTENTION REQUIRED */}
              <div className="gov-columns grid-1-2">
                <div className="card gov-jurisdiction-card bg-gradient-to-br from-[#120e1a] to-[#1e142e] border-purple-500/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-purple-300 mb-1 text-[0.75rem] uppercase tracking-wider font-bold">Current Session</h3>
                      <strong className="text-lg text-white block mb-4">
                        {authorityRole === "citizen" ? "Public View" : `${authorityRole} Officer Console`}
                      </strong>
                    </div>
                    <ShieldCheck size={24} className="text-purple-400 opacity-50" />
                  </div>
                  <label className="block text-[0.8rem] text-slate-400 mb-1">Switch Authority Access</label>
                  <select value={authorityRole} onChange={(e) => setAuthorityRole(e.target.value)} id="role-selector" className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2 text-[0.85rem] focus:outline-none focus:border-purple-500">
                    <option value="citizen">Public View (Leaderboards & Analytics)</option>
                    <option value="KNN">Kanpur Nagar Nigam (Officer Console)</option>
                    <option value="KDA">Kanpur Development Authority (Officer Console)</option>
                    <option value="JAL">Jal Kal Vibhag (Officer Console)</option>
                  </select>
                </div>

                <div className="card gov-attention-card border-amber-500/30 bg-amber-900/10">
                  <h3 className="flex items-center gap-2 text-amber-400 mb-3"><AlertTriangle size={16}/> Attention Required</h3>
                  <div className="attention-list">
                    <button className="attention-item" onClick={handleMapNavigate}>
                      <span className="attention-dot critical"></span>
                      <div className="attention-text">
                        <strong>18 Critical complaints older than 7 days</strong>
                        <span>Kanpur Nagar • Tap to view on Map</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-500" />
                    </button>
                    <button className="attention-item" onClick={handleMapNavigate}>
                      <span className="attention-dot warning"></span>
                      <div className="attention-text">
                        <strong>Becon Ganj AQI worsening rapidly (↑ 8%)</strong>
                        <span>Air Quality Alert • Tap to view on Map</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-500" />
                    </button>
                    <button className="attention-item" onClick={handleMapNavigate}>
                      <span className="attention-dot info"></span>
                      <div className="attention-text">
                        <strong>Jal Kal Vibhag resolution rate declined by 4%</strong>
                        <span>Performance Alert • Tap to view Analytics</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-500" />
                    </button>
                  </div>
                </div>
              </div>

              {/* SPATIAL ANALYTICS TOOLS */}
              <div className="card mb-4 bg-slate-900/30 border-slate-700/50">
                <h3 className="flex items-center gap-2 mb-3 text-slate-300"><MapIcon size={16}/> Spatial Intelligence Tools</h3>
                <div className="flex gap-4 items-center flex-wrap">
                  <button className="secondary-btn bg-brand/10 text-brand border-brand/20 hover:bg-brand/20" onClick={() => setShowInsight(!showInsight)} title="Explain this View">
                    <Lightbulb size={16} /> Explain Current Map View
                  </button>
                  
                  <div className="flex items-center bg-slate-900/80 rounded-full border border-slate-700/50 overflow-hidden">
                    <button 
                      className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors ${isPlayingHeatmap ? 'bg-brand text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                      onClick={() => setIsPlayingHeatmap(!isPlayingHeatmap)}
                      title={isPlayingHeatmap ? "Pause Timeline" : "Play Timeline"}
                    >
                      {isPlayingHeatmap ? <span className="w-2 h-2 bg-white rounded-sm"></span> : <span className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-current border-b-[4px] border-b-transparent"></span>}
                      {isPlayingHeatmap ? 'Pause' : 'Play'}
                    </button>
                    <div className="w-px h-4 bg-slate-700 mx-1"></div>
                    <div className="flex text-[0.7rem] font-medium items-center px-1">
                      <span className="text-slate-500 mr-1 text-[0.65rem] uppercase tracking-wider hidden sm:inline">Timeline:</span>
                      <button className={`px-2 py-1 rounded transition-colors ${heatmapPeriod === 7 ? 'bg-brand/20 text-brand' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`} onClick={() => setHeatmapPeriod(7)}>7D</button>
                      <button className={`px-2 py-1 rounded transition-colors ${heatmapPeriod === 30 ? 'bg-brand/20 text-brand' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`} onClick={() => setHeatmapPeriod(30)}>30D</button>
                      <button className={`px-2 py-1 rounded transition-colors ${heatmapPeriod === 90 ? 'bg-brand/20 text-brand' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`} onClick={() => setHeatmapPeriod(90)}>90D</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* TREND CHARTS */}
              <div className="gov-columns grid-2-1">
                <div className="card gov-chart-card">
                  <div className="flex justify-between items-center mb-4">
                    <h3>Resolution Trend</h3>
                    <div className="compact-filters">
                      <button className={`filter-btn ${govResolutionPeriod === '7' ? 'active' : ''}`} onClick={() => setGovResolutionPeriod('7')}>7D</button>
                      <button className={`filter-btn ${govResolutionPeriod === '30' ? 'active' : ''}`} onClick={() => setGovResolutionPeriod('30')}>30D</button>
                      <button className={`filter-btn ${govResolutionPeriod === '90' ? 'active' : ''}`} onClick={() => setGovResolutionPeriod('90')}>90D</button>
                    </div>
                  </div>
                  
                  {/* Mock Chart Visualization */}
                  <div className="mock-chart-container">
                    <div className="mock-chart-stats flex gap-6 mb-4">
                      <div><span className="block text-[0.7rem] text-slate-400 uppercase">Received</span><strong className="text-lg text-white">{mockResolutionData[govResolutionPeriod].received}</strong></div>
                      <div><span className="block text-[0.7rem] text-emerald-400 uppercase">Resolved</span><strong className="text-lg text-emerald-400">{mockResolutionData[govResolutionPeriod].resolved}</strong></div>
                      <div><span className="block text-[0.7rem] text-amber-400 uppercase">Open</span><strong className="text-lg text-amber-400">{mockResolutionData[govResolutionPeriod].open}</strong></div>
                    </div>
                    <div className="mock-bar-chart flex items-end gap-1 h-[120px] border-b border-slate-700 pb-1">
                      {/* Generating random bars for visual effect based on period */}
                      {Array.from({length: govResolutionPeriod === '7' ? 7 : 14}).map((_, i) => {
                        // Deterministic random for visual stability during renders
                        const seededRandom = ((i * 13) % 100) / 100;
                        const h1 = 30 + seededRandom * 50;
                        const h2 = h1 * (0.5 + ((i * 7) % 50) / 100);
                        return (
                          <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1 group">
                            <div className="w-full bg-slate-700/50 rounded-t-sm relative transition-all group-hover:bg-slate-600" style={{height: `${h1}%`}}>
                              <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/70 rounded-b-sm" style={{height: `${(h2/h1)*100}%`}}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[0.65rem] text-slate-500 mt-2 uppercase">
                      <span>{govResolutionPeriod} Days Ago</span>
                      <span>Today</span>
                    </div>
                  </div>
                </div>

                <div className="card gov-volume-card flex flex-col justify-between">
                  <div>
                    <h3>Complaint Volume</h3>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="bg-rose-500/20 p-3 rounded-full text-rose-400">
                        <TrendingUp size={24} />
                      </div>
                      <div>
                        <strong className="text-xl text-rose-400">Increasing</strong>
                        <p className="text-[0.75rem] text-slate-400">Up 14% vs previous 30 days</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 border-t border-slate-800 pt-4">
                    <h3 className="text-[0.75rem] text-slate-400 mb-2 uppercase">Top Rising Categories</h3>
                    <div className="flex justify-between text-[0.8rem] mb-1"><span className="text-white">Roads & Potholes</span><span className="text-rose-400">+22%</span></div>
                    <div className="flex justify-between text-[0.8rem] mb-1"><span className="text-white">Sanitation & Waste</span><span className="text-rose-400">+15%</span></div>
                    <div className="flex justify-between text-[0.8rem]"><span className="text-slate-300">Streetlights</span><span className="text-slate-400">+2%</span></div>
                  </div>
                </div>
              </div>

              {/* AUTHORITY & WARD & ACCOUNTABILITY */}
              <div className="gov-columns grid-1-1-1">
                {/* Authority Leaderboard */}
                <div className="card gov-authority-card">
                  <h3>Authority Performance</h3>
                  <table className="gov-table mt-3 w-full text-left">
                    <thead>
                      <tr className="text-slate-400 text-[0.7rem] uppercase border-b border-slate-800">
                        <th className="pb-2 font-normal">Authority</th>
                        <th className="pb-2 font-normal">Res Rate</th>
                        <th className="pb-2 font-normal">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {authorities.map((auth, i) => (
                        <tr key={i} className="cursor-pointer border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors" onClick={() => setSelectedAuthorityDetails(auth)}>
                          <td className="py-2 font-medium text-[0.8rem] text-white">{auth.name}</td>
                          <td className="py-2 text-[0.8rem] text-[#22d3ee] font-bold">{auth.metrics?.score || 75}%</td>
                          <td className="py-2 text-[0.8rem] text-amber-400">{auth.metrics?.open_complaints || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Authority Detail Modal/Drawer (In-place) */}
                  {selectedAuthorityDetails && (
                    <div className="authority-detail-panel mt-4 p-3 bg-slate-900/80 border border-slate-700 rounded-md animate-in fade-in slide-in-from-top-2">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-white text-[0.85rem]">{selectedAuthorityDetails.name}</h4>
                        <button onClick={() => setSelectedAuthorityDetails(null)} className="text-slate-400 hover:text-white"><X size={14}/></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[0.75rem] mb-3">
                        <div className="bg-slate-800/80 p-2 rounded border border-slate-700/50">
                          <span className="text-slate-400 block mb-1 text-[0.65rem] uppercase tracking-wider">Res Rate</span>
                          <strong className="text-[#22d3ee] text-[0.95rem]">{selectedAuthorityDetails.metrics?.score || 75}%</strong>
                        </div>
                        <div className="bg-slate-800/80 p-2 rounded border border-slate-700/50">
                          <span className="text-slate-400 block mb-1 text-[0.65rem] uppercase tracking-wider">Avg Response</span>
                          <strong className="text-white text-[0.95rem]">2.4 days</strong>
                        </div>
                        <div className="bg-slate-800/80 p-2 rounded border border-slate-700/50">
                          <span className="text-slate-400 block mb-1 text-[0.65rem] uppercase tracking-wider">Citizen Sat.</span>
                          <strong className="text-amber-400 text-[0.95rem]">4.1 ★</strong>
                        </div>
                        <div className="bg-slate-800/80 p-2 rounded border border-slate-700/50">
                          <span className="text-slate-400 block mb-1 text-[0.65rem] uppercase tracking-wider">Open Critical</span>
                          <strong className="text-rose-400 text-[0.95rem]">12</strong>
                        </div>
                      </div>
                      <button onClick={handleMapNavigate} className="btn-secondary w-full text-[0.75rem] py-1.5 flex justify-center items-center gap-2">
                        <Map size={14}/> View on Map
                      </button>
                    </div>
                  )}
                </div>

                {/* Ward AQI */}
                <div className="card gov-ward-card">
                  <h3>Ward AQI Performance</h3>
                  <ul className="ward-ranking-list mt-3 flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {wardRankings.slice(0, 10).map((ward, i) => {
                      const mockTrend = i % 3 === 0 ? "↑ 8%" : i % 2 === 0 ? "↓ 4%" : "-";
                      const trendColor = mockTrend.includes("↑") ? "text-rose-400" : mockTrend.includes("↓") ? "text-emerald-400" : "text-slate-500";
                      return (
                        <li key={i} className="flex justify-between items-center text-[0.8rem] bg-slate-900/50 border border-slate-800 rounded p-2 hover:border-slate-600 cursor-pointer transition-colors" onClick={handleMapNavigate}>
                          <span className="text-white">{i + 1}. {ward.name}</span>
                          <div className="flex items-center gap-3">
                            <strong style={{ color: scoreToColor(ward.area_score) }}>{ward.area_score} AQI</strong>
                            <span className={`text-[0.7rem] w-8 text-right font-medium ${trendColor}`}>{mockTrend}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Accountability & Export */}
                <div className="flex flex-col gap-4">
                  <div className="card gov-accountability-card">
                    <h3>Civic Accountability</h3>
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="flex justify-between items-center p-2 bg-slate-900/50 rounded border border-slate-800 text-[0.8rem]">
                        <span className="text-slate-300">Citizen Confirmation</span>
                        <strong className="text-emerald-400">88%</strong>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-slate-900/50 rounded border border-slate-800 text-[0.8rem]">
                        <span className="text-slate-300">Disputed Resolutions</span>
                        <strong className="text-rose-400">42 open</strong>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-slate-900/50 rounded border border-slate-800 text-[0.8rem]">
                        <span className="text-slate-300">Overdue Complaints</span>
                        <strong className="text-amber-400">156</strong>
                      </div>
                    </div>
                  </div>

                  <div className="card gov-export-card border-slate-700/50 bg-slate-900/30">
                    <h3 className="flex items-center gap-2 text-white"><Download size={14}/> Civic Data</h3>
                    <p className="text-[0.7rem] text-slate-400 mb-3 mt-1">Export public immutable logs.</p>
                    <div className="flex gap-2">
                      <button onClick={() => window.open("/api/complaints/export", "_blank")} className="btn-secondary flex-1 text-[0.7rem] py-1.5 flex justify-center items-center gap-1">
                        CSV
                      </button>
                      <button className="btn-secondary flex-1 text-[0.7rem] py-1.5 flex justify-center items-center gap-1 opacity-50 cursor-not-allowed border-dashed" title="JSON export coming soon">
                        JSON
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* OFFICER WORKSPACE (Hidden unless authenticated, but keeping logic just in case) */}
              {authorityRole !== "citizen" && (
                <div className="card officer-workspace mt-4" id="officer-panel">
                  {/* Keeping Officer workspace logic unchanged from existing implementation */}
                  <div className="workspace-header flex justify-between items-center mb-2">
                    <h3 id="officer-workspace-title">{authorityRole} Officer Workspace</h3>
                    <span className="badge-active-jurisdiction bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-[0.7rem]">Admin Jurisdiction Active</span>
                  </div>
                  <div className="alert-info" style={{ display: "flex", alignItems: "center" }}>
                    <ShieldAlert size={16} color="var(--critical)" style={{ marginRight: "8px" }} /> Complaints are permanently recorded in the civic ledger and cannot be deleted. All state transitions are logged.
                  </div>
                  <div className="complaints-filter-group mt-2">
                    <label className="text-[0.8rem] flex items-center gap-2">
                      <input type="checkbox" checked={viewModerationQueue} onChange={(e) => setViewModerationQueue(e.target.checked)} id="chk-moderation-queue"/>
                      View Pending AI Moderation Queue
                    </label>
                  </div>
                  <div className="officer-complaints-box mt-3">
                    <h4 className="text-[0.9rem] font-medium border-b border-slate-800 pb-1 mb-2">Assigned Civic Complaints</h4>
                    <ul id="officer-complaints-list" className="stack-list">
                      {officerComplaints.length === 0 ? (
                        <li className="muted text-center py-3">No pending complaints assigned to this jurisdiction.</li>
                      ) : (
                        officerComplaints.map((c, i) => (
                          <li key={i} className={c.escalated ? "escalated-pulse" : ""}>
                            <strong>
                              <span><span style={{display: 'inline-flex', verticalAlign: 'middle', marginRight: '6px'}}>{ISSUE_ICONS[c.issue_type] || <MapPin size={16} />}</span> {c.issue_type} - {c.place_name}</span>
                              <span className={`badge-status ${c.status.toLowerCase().replace(" ", "")}`}>{c.status}</span>
                            </strong>
                            <p>{c.description}</p>
                            <p className="text-[0.72rem] text-slate-400">trust score: {c.user_trust_score}</p>
                            <div className="mt-2 flex gap-1 justify-end">
                              {c.status === "Submitted" && <button onClick={() => handleStatusAdvance(c.complaint_id, "Verified")} className="btn-verify py-1 px-2 w-auto mt-0">Verify Issue</button>}
                              {c.status === "Verified" && <button onClick={() => handleStatusAdvance(c.complaint_id, "Assigned")} className="btn-verify py-1 px-2 w-auto mt-0">Assign Team</button>}
                              {c.status === "Assigned" && <button onClick={() => handleStatusAdvance(c.complaint_id, "In Progress")} className="btn-verify py-1 px-2 w-auto mt-0">Start Work</button>}
                              {c.status === "In Progress" && <button onClick={() => handleStatusAdvance(c.complaint_id, "Resolved")} className="btn-verify py-1 px-2 w-auto mt-0">Mark Resolved</button>}
                              {c.status === "Moderation" && (
                                <>
                                  <button onClick={() => handleStatusAdvance(c.complaint_id, "Submitted")} className="btn-confirm py-1 px-2 w-auto mt-0">Approve</button>
                                  <button onClick={() => handleStatusAdvance(c.complaint_id, "Closed")} className="btn-dispute py-1 px-2 w-auto mt-0">Reject</button>
                                </>
                              )}
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
        )}
      </main>
      {/* Global Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20" onClick={() => setShowSearchModal(false)}>
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center px-4 py-3 border-b border-slate-800">
              <Search size={18} className="text-slate-400 mr-3" />
              <input
                autoFocus
                type="text"
                placeholder="Search anywhere (locations, complaints, authorities)..."
                className="bg-transparent border-none outline-none w-full text-white placeholder:text-slate-500"
                value={searchQuery}
                onChange={handleSearch}
              />
              <button onClick={() => setShowSearchModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto">
              {searchQuery && searchResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-500 text-sm">
                  No results found for "{searchQuery}"
                </div>
              ) : !searchQuery ? (
                <div className="px-4 py-8 text-center text-slate-500 text-sm">
                  <div className="flex justify-center gap-4 mb-4 opacity-60">
                    <span className="flex items-center gap-1"><kbd className="bg-slate-800 px-1.5 rounded">M</kbd> Map</span>
                    <span className="flex items-center gap-1"><kbd className="bg-slate-800 px-1.5 rounded">A</kbd> AQI</span>
                    <span className="flex items-center gap-1"><kbd className="bg-slate-800 px-1.5 rounded">C</kbd> Complaints</span>
                    <span className="flex items-center gap-1"><kbd className="bg-slate-800 px-1.5 rounded">R</kbd> Report</span>
                  </div>
                  Type to start searching Nirikshan Ledger.
                </div>
              ) : (
                <div className="py-2">
                  <div className="px-4 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider">LOCATIONS</div>
                  <ul className="search-results-modal">
                    {searchResults.map((f, i) => (
                      <li key={i} onClick={() => selectSearchResult(f)} className="px-4 py-2 hover:bg-slate-800 cursor-pointer flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-brand">
                          {PLACE_ICONS[f.properties.type] || <MapPin size={14}/>}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-200">{f.properties.name}</div>
                          <div className="text-xs text-slate-500">{f.properties.type} • {f.properties.address}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
