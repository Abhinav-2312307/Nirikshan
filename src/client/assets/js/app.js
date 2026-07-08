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

// Application State
const state = {
  activeTab: "map",      // "map" | "citizen" | "governance"
  activeMode: "explore", // "explore" | "aqi" | "heatmap"
  userTrustScore: 50,
  userVerifiedOtp: false,
  userVerifiedAadhaar: false,
  userId: "demo-citizen-101",
  
  selectedPlaceState: null,
  selectedClick: null,
  selectedMarker: null,
  selectedLayer: null,
  
  aqiLayer: null,
  loadedAqiLevel: null,
  placesLayer: null,
  
  authorityRole: "citizen", // "citizen" | "KNN" | "KDA" | "JAL"
  viewModerationQueue: false
};

// Initialize Leaflet Map
const map = L.map("map", { 
  zoomControl: true,
  minZoom: 3,
  maxZoom: 18
}).setView([26.4185, 80.305], 13); // Centered on Naubasta, Kanpur

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: "© OpenStreetMap contributors, © CartoDB",
  subdomains: "abcd",
  maxZoom: 20
}).addTo(map);

const markerCluster = L.markerClusterGroup();
map.addLayer(markerCluster);

let heatLayer = L.heatLayer([], { radius: 26, blur: 22, maxZoom: 18 }).addTo(map);

// Run initialization
init().catch((err) => {
  console.error("Initialization error:", err);
});

async function init() {
  bindUIEvents();
  await refreshAqiLayer();
  await loadPlacesLayer();
  await refreshMetrics();
  await refreshComplaints();
  
  // Set initial map mode display state
  updateMapVisuals();
  
  // Listen to map zoom changes to handle hierarchical layer swaps
  map.on("zoomend", handleZoomEnd);

  // Map clicks for placing custom pins
  map.on("click", async (e) => {
    state.selectedClick = e.latlng;
    await resolveAndRenderPlace(e.latlng.lat, e.latlng.lng);
  });
}

function bindUIEvents() {
  // Tab Navigation Links
  document.getElementById("tab-map").addEventListener("click", () => switchTab("map"));
  document.getElementById("tab-citizen").addEventListener("click", () => switchTab("citizen"));
  document.getElementById("tab-governance").addEventListener("click", () => switchTab("governance"));

  // Map Visual Mode Controls
  document.getElementById("mode-explore").addEventListener("click", () => switchMapMode("explore"));
  document.getElementById("mode-aqi").addEventListener("click", () => switchMapMode("aqi"));
  document.getElementById("mode-heatmap").addEventListener("click", () => switchMapMode("heatmap"));

  // Form Submissions
  document.getElementById("review-form").addEventListener("submit", onSubmitReview);
  document.getElementById("complaint-form").addEventListener("submit", onSubmitComplaint);

  // Trust score verification buttons
  document.getElementById("btn-verify-otp").addEventListener("click", handleVerifyOtp);
  document.getElementById("btn-verify-aadhaar").addEventListener("click", handleVerifyAadhaar);

  // Interactive Lists Loops
  document.getElementById("complaint-list").addEventListener("click", onListActions);
  document.getElementById("my-reports-list").addEventListener("click", onListActions);
  document.getElementById("officer-complaints-list").addEventListener("click", onListActions);

  // Government Panel Role Selector
  document.getElementById("role-selector").addEventListener("change", handleRoleSelectorChange);
  document.getElementById("chk-moderation-queue").addEventListener("change", handleModerationQueueToggle);

  // Data Export Button
  document.getElementById("btn-export-csv").addEventListener("click", () => {
    window.open("/api/complaints/export", "_blank");
  });

  // Simulated Photo upload
  document.getElementById("btn-upload-photo").addEventListener("click", handlePhotoUploadSimulation);

  // Place search
  const searchInput = document.getElementById("search-input");
  const debouncedSearch = debounce(onSearchInput, 220);
  searchInput.addEventListener("input", debouncedSearch);
  searchInput.addEventListener("focus", debouncedSearch);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) {
      hideSearchResults();
    }
  });
}

// Switch UI tab view
function switchTab(tabName) {
  state.activeTab = tabName;
  
  // Update nav buttons
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  document.getElementById(`tab-${tabName}`).classList.add("active");

  // Show selected side panel view
  document.querySelectorAll(".panel-view").forEach(panel => panel.classList.remove("active"));
  document.getElementById(`view-${tabName}`).classList.add("active");

  if (tabName === "citizen") {
    renderCitizenDashboard();
  } else if (tabName === "governance") {
    renderGovernanceDashboard();
  }
}

// Switch map visual mode
function switchMapMode(modeName) {
  state.activeMode = modeName;
  
  // Update control button active class
  document.querySelectorAll(".mode-btn").forEach(btn => btn.classList.remove("active"));
  document.getElementById(`mode-${modeName}`).classList.add("active");

  updateMapVisuals();
}

// Hide or show map layers based on the active mode
function updateMapVisuals() {
  const legendCard = document.getElementById("map-legend");
  
  // Reset all
  if (state.aqiLayer) map.removeLayer(state.aqiLayer);
  if (map.hasLayer(heatLayer)) map.removeLayer(heatLayer);
  markerCluster.clearLayers();
  
  if (state.activeMode === "explore") {
    legendCard.classList.add("hide");
    if (state.placesLayer) state.placesLayer.addTo(map);
    refreshComplaints(); // Restores pins
  } 
  
  else if (state.activeMode === "aqi") {
    legendCard.classList.remove("hide");
    if (state.placesLayer) map.removeLayer(state.placesLayer);
    refreshAqiLayer(); // Restores color-coded polygons
  } 
  
  else if (state.activeMode === "heatmap") {
    legendCard.classList.add("hide");
    if (state.placesLayer) map.removeLayer(state.placesLayer);
    refreshComplaints(); // Re-adds heatPoints
    heatLayer.addTo(map);
  }
}

// Handle zoom based layer swapping in AQI Mode
async function handleZoomEnd() {
  if (state.activeMode !== "aqi") return;
  const z = map.getZoom();
  
  let targetLevel = "macro";
  let labelText = "Ward Boundaries";
  
  if (z < 6) {
    targetLevel = "india-states";
    labelText = "India State Boundaries";
  } else if (z < 9) {
    targetLevel = "up-districts";
    labelText = "UP District Boundaries";
  } else if (z < 12) {
    targetLevel = "kanpur-subdistricts";
    labelText = "Kanpur Subdistricts";
  } else if (z < 14) {
    targetLevel = "macro";
    labelText = "Ward Boundaries (Kanpur)";
  } else if (z < 16) {
    targetLevel = "micro";
    labelText = "Micro Sector Blocks";
  } else {
    targetLevel = "submicro";
    labelText = "Sub-region Segments";
  }

  document.getElementById("zoom-level-text").textContent = `Active Level: ${labelText}`;
  
  if (state.loadedAqiLevel !== targetLevel) {
    await refreshAqiLayer(targetLevel);
  }
}

// Load and render AQI boundaries
async function refreshAqiLayer(level = null) {
  if (!level) {
    // Determine level from current zoom
    const z = map.getZoom();
    if (z < 6) level = "india-states";
    else if (z < 9) level = "up-districts";
    else if (z < 12) level = "kanpur-subdistricts";
    else if (z < 14) level = "macro";
    else if (z < 16) level = "micro";
    else level = "submicro";
  }

  if (state.aqiLayer) map.removeLayer(state.aqiLayer);
  
  state.loadedAqiLevel = level;

  let labelText = "Ward Boundaries";
  if (level === "india-states") labelText = "India State Boundaries";
  else if (level === "up-districts") labelText = "UP District Boundaries";
  else if (level === "kanpur-subdistricts") labelText = "Kanpur Subdistricts";
  else if (level === "macro") labelText = "Ward Boundaries (Kanpur)";
  else if (level === "micro") labelText = "Micro Sector Blocks";
  else if (level === "submicro") labelText = "Sub-region Segments";

  const zoomTextEl = document.getElementById("zoom-level-text");
  if (zoomTextEl) {
    zoomTextEl.textContent = `Active Level: ${labelText}`;
  }
  const data = await api(`/api/areas?level=${level}`);
  
  state.aqiLayer = L.geoJSON(data, {
    style: (feature) => ({
      fillColor: scoreToColor(feature.properties.area_score),
      fillOpacity: 0.65,
      opacity: 0.8,
      color: "#ffffff",
      weight: 1.5,
      className: "aqi-region"
    }),
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(`<strong>${feature.properties.name}</strong><br>AQI Score: ${feature.properties.area_score} (${feature.properties.area_status || "Unknown"})`, {
        sticky: true
      });
      
      // Let polygons be clickable in AQI mode to fly to them and zoom
      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        const center = layer.getBounds().getCenter();
        const currentZoom = map.getZoom();
        
        let nextZoom = currentZoom + 3;
        if (level === "india-states") nextZoom = 7;
        else if (level === "up-districts") nextZoom = 10;
        else if (level === "kanpur-subdistricts") nextZoom = 13;
        else if (level === "macro") nextZoom = 15;
        
        map.flyTo(center, nextZoom, { duration: 0.8 });
      });
    }
  });

  if (state.activeMode === "aqi") {
    state.aqiLayer.addTo(map);
  }
}

// Load places vectors layer (roads/parks)
function getPlaceStyle(feature, styleState = "base") {
  const type = feature.properties.type;
  if (styleState === "selected") {
    if (type === "road") return { color: "#f43f5e", weight: 9, opacity: 1.0, lineCap: "round" };
    if (type === "park") return { color: "#f43f5e", weight: 3, fillColor: "#fda4af", fillOpacity: 0.55 };
    return { color: "#f43f5e", weight: 4, fillColor: "#fda4af", fillOpacity: 0.4 };
  }
  if (styleState === "hover") {
    if (type === "road") return { color: "#22d3ee", weight: 8, opacity: 1.0, lineCap: "round" };
    if (type === "park") return { color: "#34d399", weight: 2.5, fillColor: "#6ee7b7", fillOpacity: 0.45 };
    return { color: "#cbd5e1", weight: 3.5, fillColor: "#e2e8f0", fillOpacity: 0.35 };
  }
  // Default base style
  if (type === "road") return { color: "#67e8f9", weight: 5, opacity: 0.8, lineCap: "round" };
  if (type === "park") return { color: "#10b981", weight: 1.5, fillColor: "#34d399", fillOpacity: 0.35 };
  return { color: "#94a3b8", weight: 2, fillColor: "#cbd5e1", fillOpacity: 0.2 };
}

// Load places vectors layer (roads/parks)
async function loadPlacesLayer() {
  const data = await api("/api/places?limit=300");
  
  state.placesLayer = L.geoJSON(data, {
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
        if (state.selectedLayer === layer) return;
        layer.setStyle(getPlaceStyle(feature, "hover"));
      });
      layer.on("mouseout", (e) => {
        if (state.selectedLayer === layer) return;
        layer.setStyle(getPlaceStyle(feature, "base"));
      });
      layer.on("click", async (e) => {
        L.DomEvent.stopPropagation(e);
        state.selectedClick = e.latlng;
        
        // Reset previous selected layer style
        if (state.selectedLayer && state.selectedLayer !== layer) {
          const oldFeature = state.selectedLayer.feature;
          state.selectedLayer.setStyle(getPlaceStyle(oldFeature, "base"));
        }
        
        state.selectedLayer = layer;
        layer.setStyle(getPlaceStyle(feature, "selected"));
        
        await resolveAndRenderPlace(e.latlng.lat, e.latlng.lng);
      });
      layer.bindTooltip(`${feature.properties.name} (${feature.properties.type})`);
    }
  });

  if (state.activeMode === "explore") {
    state.placesLayer.addTo(map);
  }
}

// Resolve selected coordinates
async function resolveAndRenderPlace(lat, lng) {
  const resolved = await api(`/api/places/resolve?lat=${lat}&lng=${lng}`);
  state.selectedPlaceState = resolved;

  if (resolved.is_virtual) {
    if (state.selectedLayer) {
      const oldFeature = state.selectedLayer.feature;
      state.selectedLayer.setStyle(getPlaceStyle(oldFeature, "base"));
      state.selectedLayer = null;
    }
    if (state.selectedMarker) map.removeLayer(state.selectedMarker);
    const tempIcon = L.divIcon({
      className: "",
      html: `<div class="place-pin" style="border-color: #f43f5e; box-shadow: 0 0 12px #f43f5e;">📍</div>`,
      iconSize: [26, 26]
    });
    state.selectedMarker = L.marker([lat, lng], { icon: tempIcon }).addTo(map);
  } else {
    if (state.selectedMarker) {
      map.removeLayer(state.selectedMarker);
      state.selectedMarker = null;
    }
    if (state.placesLayer) {
      state.placesLayer.eachLayer((layer) => {
        if (layer.feature && layer.feature.properties && layer.feature.properties.place_id === resolved.place.properties.place_id) {
          if (state.selectedLayer && state.selectedLayer !== layer) {
            state.selectedLayer.setStyle(getPlaceStyle(state.selectedLayer.feature, "base"));
          }
          state.selectedLayer = layer;
          layer.setStyle(getPlaceStyle(layer.feature, "selected"));
        }
      });
    }
  }

  // Render text summary
  const place = resolved.place.properties;
  const metrics = resolved.metrics;
  const areaName = resolved.area ? `${resolved.area.name}, ${resolved.area.city}` : "Outside mapped region";
  
  document.getElementById("place-type").textContent = `${place.type} ${resolved.is_virtual ? "(pin drop)" : ""}`;
  document.getElementById("place-name").textContent = place.name;
  document.getElementById("place-address").textContent = place.address || "No address metadata";
  document.getElementById("place-rating").textContent = metrics.avg_rating ? `${metrics.avg_rating}/5` : "No ratings";
  document.getElementById("place-reviews").textContent = String(metrics.review_count);
  document.getElementById("place-complaints").textContent = String(metrics.complaint_count);
  document.getElementById("place-pending").textContent = String(metrics.pending_complaints);
  
  document.getElementById("place-jurisdiction").textContent = `Jurisdiction: ${areaName}${
    resolved.area ? ` | Auth: ${resolved.area.authority}` : ""
  }`;

  // Reveal submission widgets
  document.getElementById("rating-submission-card").classList.remove("hide");
  document.getElementById("complaint-submission-card").classList.remove("hide");
  document.getElementById("place-reviews-list-card").classList.remove("hide");
  document.getElementById("place-complaints-list-card").classList.remove("hide");

  // Render recent lists
  await Promise.all([
    renderReviewsList(place.place_id),
    renderPlaceComplaintsList(place.place_id)
  ]);
  
  // Auto slide tab to Map if selected elsewhere
  if (state.activeTab !== "map") {
    switchTab("map");
  }
}

// Render reviews in the sidebar
async function renderReviewsList(placeId) {
  const data = await api(`/api/places/${encodeURIComponent(placeId)}/reviews`);
  const list = document.getElementById("review-list");
  
  if (!data.length) {
    list.innerHTML = `<li class="muted text-center" style="padding: 12px 0;">No reviews registered for this place yet.</li>`;
    return;
  }

  list.innerHTML = data.slice(0, 5).map(r => {
    const timeStr = new Date(r.created_at).toLocaleString();
    const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
    return `
      <li>
        <strong><span>${stars}</span><span style="color: var(--muted); font-size: 0.72rem;">${timeStr}</span></strong>
        <p>${escapeHtml(r.comment)}</p>
      </li>
    `;
  }).join("");
}

// Render place complaints list in the sidebar
async function renderPlaceComplaintsList(placeId) {
  const data = await api(`/api/complaints?place_id=${encodeURIComponent(placeId)}&include_moderation=true`);
  const list = document.getElementById("complaint-list");
  
  if (!data.length) {
    list.innerHTML = `<li class="muted text-center" style="padding: 12px 0;">No complaints reported for this place yet.</li>`;
    return;
  }

  list.innerHTML = data.slice(0, 5).map(c => {
    const isEscalatedClass = c.escalated ? "escalated-pulse" : "";
    const isDisputedFlag = c.verification_status === "Disputed" ? `<span class="disputed-flag">⚠️ Citizen Disputed</span>` : "";
    const isOverlapFlag = c.disputed_jurisdiction ? `<span class="disputed-flag" style="color: #60a5fa; border-color: rgba(96, 165, 250, 0.2); background: rgba(96, 165, 250, 0.1);">🌐 Overlapping Jurisdiction (Multi-Routed)</span>` : "";
    const flagStr = isDisputedFlag || isOverlapFlag;
    
    return `
      <li class="${isEscalatedClass}">
        <strong>
          <span>${ISSUE_ICONS[c.issue_type] || "📍"} ${c.issue_type}</span>
          <span class="badge-status ${c.status.toLowerCase().replace(" ", "")}">${c.status}</span>
        </strong>
        <p>${escapeHtml(c.description)}</p>
        <p style="font-size: 0.72rem; color: var(--muted); display: flex; justify-content: space-between; margin-top: 6px;">
          <span>Dept: ${c.department} (${c.authority_id})</span>
          <span>Score at Post: ${c.user_trust_score}</span>
        </p>
        ${flagStr}
        <div style="margin-top: 6px; display: flex; gap: 4px; justify-content: flex-end;">
          <button class="status-action btn-secondary" style="padding: 3px 8px; font-size: 0.7rem; width: auto; margin-top: 0;" data-action="flag" data-id="${c.complaint_id}">🚩 Flag Spam (${c.flags_count || 0})</button>
        </div>
      </li>
    `;
  }).join("");
}

// Refresh overall dashboard count metrics
async function refreshMetrics() {
  const summary = await api("/api/analytics/summary");
  document.getElementById("metric-total").textContent = String(summary.total);
  document.getElementById("metric-pending").textContent = String(summary.pending);
  document.getElementById("metric-resolved").textContent = String(summary.resolved);
  document.getElementById("metric-high").textContent = String(summary.highPriority);
}

// Load and render complaints markers on map
async function refreshComplaints() {
  const list = await api("/api/complaints?include_moderation=true");
  
  if (state.activeMode === "explore") {
    markerCluster.clearLayers();
    list.forEach(c => {
      // Don't show moderation queue ones to public Explore map
      if (c.status === "Moderation") return;

      const isEscalatedStr = c.escalated ? ` | <span style="color: var(--red); font-weight:700;">ESCALATED (No update > 30d)</span>` : "";
      const isDisputedStr = c.verification_status === "Disputed" ? ` | <span style="color: var(--red); font-weight:700;">DISPUTED RESOLUTION</span>` : "";
      
      let duplicateAlert = "";
      if (c.is_duplicate) {
        duplicateAlert = `<br><span style="color: var(--yellow); font-size: 0.78rem; font-weight:600;">⚠️ Linked as duplicate of complaint #${c.duplicate_of.slice(0, 8)}</span>`;
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
        <div style="font-family: var(--font-body); color: #1e293b; max-width: 250px;">
          <h4 style="margin: 0; font-family: var(--font-title); font-size: 0.95rem; display: flex; justify-content: space-between; align-items: center;">
            <span>${ISSUE_ICONS[c.issue_type] || "📍"} ${c.issue_type}</span>
            <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 99px; background: #e2e8f0; color: #475569;">${c.status}</span>
          </h4>
          <p style="margin: 6px 0; font-size: 0.8rem;">${escapeHtml(c.description)}</p>
          <div style="font-size: 0.74rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px;">
            ${routeText}
            ${duplicateAlert}
            <br><span style="font-size: 0.68rem; color: #94a3b8; display:block; margin-top:4px;">ID: ${c.complaint_id}</span>
          </div>
        </div>
      `);
      markerCluster.addLayer(marker);
    });
  } 
  
  else if (state.activeMode === "heatmap") {
    // Generate heatmap points
    const heatPoints = list
      .filter(c => c.status !== "Closed" && c.status !== "Moderation")
      .map(c => [c.latitude, c.longitude, c.severity / 3]);
    
    heatLayer.setLatLngs(heatPoints);
  }
}

// User Post Review
async function onSubmitReview(e) {
  e.preventDefault();
  if (!state.selectedPlaceState || !state.selectedClick) return;

  const placeId = state.selectedPlaceState.place.properties.place_id;
  const formData = new FormData(e.target);

  try {
    await api(`/api/places/${encodeURIComponent(placeId)}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        rating: Number(formData.get("rating")),
        comment: String(formData.get("comment") || "").trim(),
        user_id: state.userId
      })
    });

    e.target.reset();
    
    // Refresh UI
    await resolveAndRenderPlace(state.selectedClick.lat, state.selectedClick.lng);
    await refreshMetrics();
    await refreshAqiLayer();
    
  } catch (err) {
    alert(err.message);
  }
}

// Simulated photo upload - Face blur presentation
function handlePhotoUploadSimulation() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const previewImg = document.getElementById("image-preview");
        previewImg.src = event.target.result;
        document.getElementById("image-preview-container").classList.remove("hide");
        console.log("SIMULATOR: EXIF Metadata stripped successfully.");
        console.log("SIMULATOR: Face detection model triggered. Blurring faces on client-side canvas.");
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
}

// User submit complaint
async function onSubmitComplaint(e) {
  e.preventDefault();
  if (!state.selectedPlaceState || !state.selectedClick) return;

  const place = state.selectedPlaceState.place.properties;
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
        latitude: state.selectedClick.lat,
        longitude: state.selectedClick.lng,
        user_trust_score: state.userTrustScore
      })
    });

    e.target.reset();
    document.getElementById("image-preview-container").classList.add("hide");
    document.getElementById("image-preview").src = "";
    
    // Alert state details
    if (response.status === "Moderation") {
      alert("⚠️ Your complaint was routed to the Human Moderation Queue. Reason: Description flagged by AI NLP checks or trust score remains below threshold.");
    } else if (response.is_duplicate) {
      alert("⚠️ Similar issue reported recently in this area. AI flagged this complaint as duplicate and linked it to the existing ticket.");
    } else {
      alert("✅ Complaint filed successfully. Assigned routing transparently logged.");
    }

    // Refresh UI
    await resolveAndRenderPlace(state.selectedClick.lat, state.selectedClick.lng);
    await refreshMetrics();
    await refreshComplaints();
    await refreshAqiLayer();
    
  } catch (err) {
    alert(err.message);
  }
}

// Handle citizen verification actions (OTP / Aadhaar)
function handleVerifyOtp() {
  if (state.userVerifiedOtp) return;
  state.userVerifiedOtp = true;
  state.userTrustScore = Math.min(100, state.userTrustScore + 10);
  
  const btn = document.getElementById("btn-verify-otp");
  btn.textContent = "Verified ✓";
  btn.disabled = true;
  
  const badge = document.getElementById("badge-otp");
  badge.textContent = "📱 Mobile Verified";
  badge.className = "status-chip verified";

  updateTrustScoreUI();
}

function handleVerifyAadhaar() {
  if (state.userVerifiedAadhaar) return;
  state.userVerifiedAadhaar = true;
  state.userTrustScore = Math.min(100, state.userTrustScore + 30);
  
  const btn = document.getElementById("btn-verify-aadhaar");
  btn.textContent = "Verified ✓";
  btn.disabled = true;
  
  const badge = document.getElementById("badge-aadhaar");
  badge.textContent = "🆔 Aadhaar Verified";
  badge.className = "status-chip verified";

  updateTrustScoreUI();
}

function updateTrustScoreUI() {
  document.getElementById("citizen-trust-score").textContent = `Trust Score: ${state.userTrustScore}/100`;
  document.getElementById("trust-progress").style.width = `${state.userTrustScore}%`;
}

// Render Citizen Dashboard View
async function renderCitizenDashboard() {
  updateTrustScoreUI();
  
  const list = document.getElementById("my-reports-list");
  const complaints = await api("/api/complaints?include_moderation=true");
  
  // In demo mode, show all complaints as belonging to the citizen
  if (!complaints.length) {
    list.innerHTML = `<li class="muted text-center" style="padding: 12px 0;">You have not reported any civic issues yet.</li>`;
    return;
  }

  list.innerHTML = complaints.map(c => {
    const isResolved = c.status === "Resolved";
    const verificationLoopWidget = isResolved ? `
      <div class="verification-loop-actions">
        <button class="btn-confirm" data-action="confirm" data-id="${c.complaint_id}">✅ Confirm Resolution</button>
        <button class="btn-dispute" data-action="dispute" data-id="${c.complaint_id}">❌ Dispute Resolution</button>
      </div>
    ` : "";

    const disputedFlag = c.verification_status === "Disputed" ? `<div class="disputed-flag">⚠️ Resolution Disputed (Reopened)</div>` : "";
    const closedLabel = c.status === "Closed" ? `<span style="font-size:0.75rem; color:var(--muted);">Loop Closure: ${c.verification_status}</span>` : "";
    const isEscalatedClass = c.escalated ? "escalated-pulse" : "";

    return `
      <li class="${isEscalatedClass}">
        <strong>
          <span>${ISSUE_ICONS[c.issue_type] || "📍"} ${c.place_name} (${c.issue_type})</span>
          <span class="badge-status ${c.status.toLowerCase().replace(" ", "")}">${c.status}</span>
        </strong>
        <p>${escapeHtml(c.description)}</p>
        <p style="font-size: 0.72rem; color: var(--muted); margin-top: 4px; display: flex; justify-content: space-between;">
          <span>Assigned Authority: ${c.authority}</span>
          ${closedLabel}
        </p>
        ${disputedFlag}
        ${verificationLoopWidget}
      </li>
    `;
  }).join("");
}

// Toggle role select in Governance dashboard
function handleRoleSelectorChange(e) {
  state.authorityRole = e.target.value;
  renderGovernanceDashboard();
}

function handleModerationQueueToggle() {
  state.viewModerationQueue = document.getElementById("chk-moderation-queue").checked;
  renderGovernanceDashboard();
}

// Render Governance / Authority Dashboard view
async function renderGovernanceDashboard() {
  const leaderboardBody = document.getElementById("leaderboard-body");
  const rankingsList = document.getElementById("ward-ranking-list");
  const officerPanel = document.getElementById("officer-panel");

  // 1. Fetch ranking rankings & leaderboard metrics
  const [authorities, areas] = await Promise.all([
    api("/api/complaints/authorities"),
    api("/api/areas?level=macro")
  ]);

  // Render Leaderboard
  leaderboardBody.innerHTML = authorities.sort((a, b) => b.metrics.score - a.metrics.score).map(auth => {
    return `
      <tr>
        <td><strong>${auth.authority_id}</strong><br><span style="font-size:0.7rem; color:var(--muted);">${auth.name.slice(0, 16)}...</span></td>
        <td><strong style="color: ${auth.metrics.score >= 70 ? 'var(--green)' : auth.metrics.score >= 40 ? 'var(--yellow)' : 'var(--red)'}">${auth.metrics.score}/100</strong></td>
        <td>${auth.metrics.resolved_complaints}</td>
        <td><span style="color: ${auth.metrics.disputed_complaints > 0 ? 'var(--red)' : 'inherit'}">${auth.metrics.disputed_complaints}</span></td>
        <td>${auth.metrics.open_complaints}</td>
      </tr>
    `;
  }).join("");

  // Render Ward AQI Rankings
  rankingsList.innerHTML = areas.features.sort((a, b) => b.properties.area_score - a.properties.area_score).map((w, index) => {
    const score = w.properties.area_score;
    const color = score >= 81 ? 'var(--green)' : score >= 61 ? '#84cc16' : score >= 31 ? 'var(--yellow)' : 'var(--red)';
    return `
      <li>
        <span>Rank #${index + 1} - ${w.properties.name}</span>
        <span style="color: ${color}">AQI ${score}</span>
      </li>
    `;
  }).join("");

  // 2. Hide / Show Officer console Workspace
  if (state.authorityRole === "citizen") {
    officerPanel.classList.add("hide");
    return;
  }

  officerPanel.classList.remove("hide");
  const authName = state.authorityRole === "KNN" ? "Kanpur Nagar Nigam" : state.authorityRole === "KDA" ? "Kanpur Development Authority" : "Jal Kal Vibhag";
  document.getElementById("officer-workspace-title").textContent = `${authName} Officer Workspace`;

  // Fetch complaints routed to this officer
  const url = `/api/complaints?authority_id=${state.authorityRole}&include_moderation=${state.viewModerationQueue}`;
  const list = await api(url);
  const officerList = document.getElementById("officer-complaints-list");

  if (!list.length) {
    officerList.innerHTML = `<li class="muted text-center" style="padding: 12px 0;">No complaints currently assigned to this jurisdiction.</li>`;
    return;
  }

  officerList.innerHTML = list.map(c => {
    const canAdvance = c.status !== "Closed";
    let advanceBtnText = "Acknowledge Complaint";
    if (c.status === "Verified") advanceBtnText = "Assign Maintenance Team";
    else if (c.status === "Assigned") advanceBtnText = "Begin Restoration Work";
    else if (c.status === "In Progress") advanceBtnText = "Mark as Resolved";
    else if (c.status === "Resolved") advanceBtnText = "Resolved (Awaiting citizen verification)";
    else if (c.status === "Moderation") advanceBtnText = "AI Flagged: Moderate & Verify";

    const isEscalatedClass = c.escalated ? "escalated-pulse" : "";
    const disputeFlag = c.verification_status === "Disputed" ? `<span class="disputed-flag">⚠️ Citizen Disputed (Reopened)</span>` : "";
    const escalatedBadge = c.escalated ? `<span class="badge-status critical" style="margin-left: 5px;">Escalated (>30d)</span>` : "";

    return `
      <li class="${isEscalatedClass}">
        <strong>
          <span>${ISSUE_ICONS[c.issue_type] || "📍"} ${c.place_name} (${c.issue_type})</span>
          <span>
            ${escalatedBadge}
            <span class="badge-status ${c.status.toLowerCase().replace(" ", "")}">${c.status}</span>
          </span>
        </strong>
        <p>${escapeHtml(c.description)}</p>
        <p style="font-size: 0.72rem; color: var(--muted); margin-top: 4px;">
          Reported from: Lat ${c.latitude.toFixed(4)}, Lng ${c.longitude.toFixed(4)}
        </p>
        ${disputeFlag}
        <div style="margin-top: 8px; display: flex; gap: 6px; justify-content: flex-end;">
          ${
            canAdvance && c.status !== "Resolved"
              ? `<button class="status-action btn-primary" style="padding: 6px 12px; font-size: 0.74rem; width: auto; margin-top: 0;" data-action="advance" data-id="${c.complaint_id}">${advanceBtnText}</button>`
              : ""
          }
        </div>
      </li>
    `;
  }).join("");
}

// Handle List action clicks (Confirm, Dispute, Flag, Acknowledge/Resolve)
async function onListActions(e) {
  const button = e.target.closest("button[data-id]");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  try {
    if (action === "flag") {
      await api(`/api/complaints/${id}/flag`, { method: "POST" });
      if (state.selectedClick) {
        await resolveAndRenderPlace(state.selectedClick.lat, state.selectedClick.lng);
      }
    } else if (action === "confirm") {
      await api(`/api/complaints/${id}/verify`, {
        method: "POST",
        body: JSON.stringify({ outcome: "Confirmed" })
      });
      await renderCitizenDashboard();
    } else if (action === "dispute") {
      await api(`/api/complaints/${id}/verify`, {
        method: "POST",
        body: JSON.stringify({ outcome: "Disputed" })
      });
      await renderCitizenDashboard();
    } else if (action === "advance") {
      // Officer advancing status
      await api(`/api/complaints/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({})
      });
      await renderGovernanceDashboard();
    }

    // Refresh general maps and metrics
    await Promise.all([refreshMetrics(), refreshComplaints(), refreshAqiLayer()]);

  } catch (err) {
    alert(err.message);
  }
}

// API client utility
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(payload.error || "Request failed");
  }

  return response.json();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function debounce(fn, delay = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Search
async function onSearchInput() {
  const input = document.getElementById("search-input");
  const q = input.value.trim();

  if (q.length < 2) {
    hideSearchResults();
    return;
  }

  const result = await api(`/api/places?q=${encodeURIComponent(q)}&limit=8`);
  renderSearchResults(result.features);
}

function renderSearchResults(features) {
  const list = document.getElementById("search-results");

  if (!features.length) {
    list.innerHTML = `<li style="padding: 10px; color: var(--muted); text-align: center;"><strong>No matching landmarks</strong><small>Try another query</small></li>`;
    list.classList.add("visible");
    return;
  }

  list.innerHTML = features
    .map((f) => {
      const center = f.properties.center || [0, 0];
      return `<li data-place-id="${f.properties.place_id}" data-lng="${center[0]}" data-lat="${center[1]}"><strong>${escapeHtml(
        f.properties.name
      )}</strong><small>${escapeHtml(f.properties.type)} • ${escapeHtml(f.properties.address || "No address")}</small></li>`;
    })
    .join("");

  list.classList.add("visible");

  list.querySelectorAll("li[data-place-id]").forEach((li) => {
    li.addEventListener("click", async () => {
      const lat = Number(li.dataset.lat);
      const lng = Number(li.dataset.lng);

      map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
      hideSearchResults();
      state.selectedClick = L.latLng(lat, lng);
      await resolveAndRenderPlace(lat, lng);
    });
  });
}

function hideSearchResults() {
  const list = document.getElementById("search-results");
  list.classList.remove("visible");
  list.innerHTML = "";
}

function scoreToColor(score) {
  if (score >= 81) return "#10b981"; // Dark Green
  if (score >= 61) return "#84cc16"; // Light Green
  if (score >= 31) return "#fbbf24"; // Yellow
  return "#f43f5e"; // Red
}
