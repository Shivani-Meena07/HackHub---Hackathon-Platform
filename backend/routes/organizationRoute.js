const express = require("express");
const {
  createOrganization,
  getMyOrganization,
  updateOrganization,
  createHackathon,
  getMyHackathons,
} = require("../controllers/organizationController.js");
const { protect } = require("../middleware/authMiddleware.js");
const { requireOrganizer } = require("../middleware/organizerMiddleware.js");

const router = express.Router();

router.use(protect, requireOrganizer);
router.route("/").post(createOrganization);
router.route("/mine").get(getMyOrganization).patch(updateOrganization);
router.route("/mine/hackathons").get(getMyHackathons).post(createHackathon);

module.exports = router;
