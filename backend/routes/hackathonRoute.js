const express = require("express");
const {
  listPublishedHackathons,
  updateHackathon,
  publishHackathon,
  updateStage,
  updateResults,
  getRegistrations,
  updateRegistrationStatus,
} = require("../controllers/hackathonController.js");
const { protect } = require("../middleware/authMiddleware.js");
const { requireOrganizer } = require("../middleware/organizerMiddleware.js");

const router = express.Router();

router.get("/published", listPublishedHackathons);
router.use(protect, requireOrganizer);
router.patch("/:id", updateHackathon);
router.post("/:id/publish", publishHackathon);
router.patch("/:id/stage", updateStage);
router.patch("/:id/results", updateResults);
router.get("/:id/registrations", getRegistrations);
router.patch("/:id/registrations/:registrationId", updateRegistrationStatus);

module.exports = router;
