"use client";

import { useState, useEffect, useRef } from "react";
import L from "leaflet";

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
  const [userId] = useState("demo-citizen-101");
  const [authorityRole, setAuthorityRole] = useState("citizen"); // "citizen" | "KNN" | "KDA" | "JAL"
  const [viewModerationQueue, setViewModerationQueue] = useState(false);
  const [mapTheme, setMapTheme] = useState("dark"); // "dark" | "street"
  const [isLocating, setIsLocating] = useState(false);

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

      const markerCluster = L.markerClusterGroup();
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

    const data = await api(`/api/areas?level=${level}`);
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
        alert("⚠️ Your complaint was routed to the Human Moderation Queue. Reason: Description flagged by AI NLP checks or trust score remains below threshold.");
      } else if (response.is_duplicate) {
        alert("⚠️ Similar issue reported recently in this area. AI flagged this complaint as duplicate and linked it to the existing ticket.");
      } else {
        alert("✅ Complaint filed successfully. Assigned routing transparently logged.");
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

        <div className="search-wrap">
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

        <nav className="nav-links">
          <button className={`nav-btn ${activeTab === "map" ? "active" : ""}`} onClick={() => setActiveTab("map")}>Map Explorer</button>
          <button className={`nav-btn ${activeTab === "citizen" ? "active" : ""}`} onClick={() => setActiveTab("citizen")}>Citizen Dashboard</button>
          <button className={`nav-btn ${activeTab === "governance" ? "active" : ""}`} onClick={() => setActiveTab("governance")}>Governance Console</button>
        </nav>
      </header>

      <main className={`layout tab-${activeTab}`}>
        <section className="map-panel">
          <div className="map-mode-control">
            <h4>Map Visual Modes</h4>
            <div className="mode-buttons">
              <button className={`mode-btn ${activeMode === "explore" ? "active" : ""}`} onClick={() => setActiveMode("explore")}>🛣️ Explore & Rate</button>
              <button className={`mode-btn ${activeMode === "aqi" ? "active" : ""}`} onClick={() => setActiveMode("aqi")}>📊 Civic AQI Layers</button>
              <button className={`mode-btn ${activeMode === "heatmap" ? "active" : ""}`} onClick={() => setActiveMode("heatmap")}>🔥 Complaint Heatmap</button>
            </div>
            
            <div className="theme-toggle-container" style={{ marginTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.7)", fontWeight: "500" }}>Map Theme:</span>
              <div className="mode-buttons" style={{ gap: "4px" }}>
                <button 
                  className={`mode-btn ${mapTheme === "dark" ? "active" : ""}`} 
                  onClick={() => setMapTheme("dark")}
                  style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                >
                  🌑 Dark Matter
                </button>
                <button 
                  className={`mode-btn ${mapTheme === "street" ? "active" : ""}`} 
                  onClick={() => setMapTheme("street")}
                  style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                >
                  🗺️ Street View
                </button>
              </div>
            </div>
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

          <div ref={mapRef} id="map"></div>

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
              <div className="card place-card" id="place-summary-card">
                <p id="place-type" className="place-type">
                  {selectedPlace ? `${selectedPlace.place.properties.type} ${selectedPlace.is_virtual ? "(pin drop)" : ""}` : "Select a place"}
                </p>
                <h2 id="place-name">{selectedPlace ? selectedPlace.place.properties.name : "No Location Selected"}</h2>
                <p id="place-address" className="place-address">
                  {selectedPlace ? (selectedPlace.place.properties.address || "No address metadata") : "Click on any road, park, landmark, or pin a custom point on the map to rate quality or submit complaints."}
                </p>

                {selectedPlace && (
                  <>
                    <div className="metric-grid">
                      <div><label>Quality Rating</label><strong>{selectedPlace.metrics.avg_rating ? `${selectedPlace.metrics.avg_rating}/5` : "No ratings"}</strong></div>
                      <div><label>Reviews</label><strong>{selectedPlace.metrics.review_count}</strong></div>
                      <div><label>Complaints</label><strong>{selectedPlace.metrics.complaint_count}</strong></div>
                      <div><label>Pending</label><strong>{selectedPlace.metrics.pending_complaints}</strong></div>
                    </div>
                    <p id="place-jurisdiction" className="place-jurisdiction">
                      Jurisdiction: {selectedPlace.area ? `${selectedPlace.area.name}, ${selectedPlace.area.city} | Auth: ${selectedPlace.area.authority}` : "Outside mapped region"}
                    </p>
                  </>
                )}
              </div>

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
              <div className="card role-card">
                <h3>Jurisdiction Access Control</h3>
                <label>Select Authority Session
                  <select value={authorityRole} onChange={(e) => setAuthorityRole(e.target.value)} id="role-selector">
                    <option value="citizen">👤 Public View (Leaderboards & Analytics)</option>
                    <option value="KNN">🏢 Kanpur Nagar Nigam (Officer Console)</option>
                    <option value="KDA">📐 Kanpur Development Authority (Officer Console)</option>
                    <option value="JAL">🚰 Jal Kal Vibhag (Officer Console)</option>
                  </select>
                </label>
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

              {/* Officer Workspace */}
              {authorityRole !== "citizen" && (
                <div className="card officer-workspace" id="officer-panel">
                  <div className="workspace-header flex justify-between items-center mb-2">
                    <h3 id="officer-workspace-title">{authorityRole} Officer Workspace</h3>
                    <span className="badge-active-jurisdiction bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-[0.7rem]">Admin Jurisdiction Active</span>
                  </div>
                  
                  <div className="workspace-desc alert-info text-[0.74rem]">
                    🚫 Complaints are permanently recorded in the civic ledger and cannot be deleted. All state transitions are logged.
                  </div>

                  <div className="complaints-filter-group mt-2">
                    <label className="text-[0.8rem] flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={viewModerationQueue}
                        onChange={(e) => setViewModerationQueue(e.target.checked)}
                        id="chk-moderation-queue"
                      />
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
                              <span>{ISSUE_ICONS[c.issue_type] || "📍"} {c.issue_type} - {c.place_name}</span>
                              <span className={`badge-status ${c.status.toLowerCase().replace(" ", "")}`}>{c.status}</span>
                            </strong>
                            <p>{c.description}</p>
                            <p className="text-[0.72rem] text-slate-400">trust score: {c.user_trust_score}</p>
                            <div className="mt-2 flex gap-1 justify-end">
                              {c.status === "Submitted" && (
                                <button onClick={() => handleStatusAdvance(c.complaint_id, "Verified")} className="btn-verify py-1 px-2 w-auto mt-0">Verify Issue</button>
                              )}
                              {c.status === "Verified" && (
                                <button onClick={() => handleStatusAdvance(c.complaint_id, "Assigned")} className="btn-verify py-1 px-2 w-auto mt-0">Assign Team</button>
                              )}
                              {c.status === "Assigned" && (
                                <button onClick={() => handleStatusAdvance(c.complaint_id, "In Progress")} className="btn-verify py-1 px-2 w-auto mt-0">Start Work</button>
                              )}
                              {c.status === "In Progress" && (
                                <button onClick={() => handleStatusAdvance(c.complaint_id, "Resolved")} className="btn-verify py-1 px-2 w-auto mt-0">Mark Resolved</button>
                              )}
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
    </>
  );
}
