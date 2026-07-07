const express = require("express");
const path = require("path");

const areasRoutes = require("./routes/areas.routes");
const placesRoutes = require("./routes/places.routes");
const complaintsRoutes = require("./routes/complaints.routes");
const analyticsRoutes = require("./routes/analytics.routes");

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..", "client")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "civic-map-api", time: new Date().toISOString() });
});

app.use("/api/areas", areasRoutes);
app.use("/api/places", placesRoutes);
app.use("/api/complaints", complaintsRoutes);
app.use("/api/analytics", analyticsRoutes);

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

module.exports = app;
