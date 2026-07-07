const express = require("express");
const { listAreas } = require("../services/areaService");

const router = express.Router();

router.get("/", (req, res) => {
  const zoom = Number(req.query.zoom || 0);
  const requested = req.query.level;
  let level = "macro";

  if (requested) {
    level = requested;
  } else if (zoom > 0) {
    if (zoom < 5) {
      level = "india-states";
    } else if (zoom < 8) {
      level = "up-districts";
    } else if (zoom < 11) {
      level = "kanpur-subdistricts";
    } else if (zoom < 14) {
      level = "macro";
    } else if (zoom < 16) {
      level = "micro";
    } else {
      level = "submicro";
    }
  }

  res.json(listAreas(level));
});

module.exports = router;
