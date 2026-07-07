const express = require("express");
const { getSummary } = require("../services/analyticsService");

const router = express.Router();

router.get("/summary", (_req, res) => {
  res.json(getSummary());
});

module.exports = router;
