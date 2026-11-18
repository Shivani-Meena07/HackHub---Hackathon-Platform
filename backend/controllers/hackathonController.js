const mongoose = require("mongoose");
const Hackathon = require("../models/Hackathon.js");
const Organization = require("../models/Organization.js");
const { validateHackathon } = require("./organizationController.js");

const getOwnedHackathon = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: "Invalid hackathon ID" });
    return null;
  }
  const hackathon = await Hackathon.findById(req.params.id);
  if (!hackathon) {
    res.status(404).json({ message: "Hackathon not found" });
    return null;
  }
  if (req.user.role !== "admin") {
    const organization = await Organization.findOne({
      _id: hackathon.organization,
      owner: req.user._id,
    });
    if (!organization) {
      res.status(403).json({ message: "You cannot manage this organization's hackathon" });
      return null;
    }
  }
  return hackathon;
};

const listPublishedHackathons = async (req, res) => {
  try {
    const hackathons = await Hackathon.find({ published: true })
      .select(
        "organization title description eligibility registrationDeadline startDate endDate prizes stage results resultsPublished"
      )
      .populate("organization", "name website")
      .sort({ startDate: 1 })
      .lean();
    res.status(200).json({
      hackathons: hackathons.map((hackathon) => {
        if (!hackathon.resultsPublished) {
          hackathon.results = [];
        }
        return hackathon;
      }),
    });
  } catch (error) {
    console.error("LIST PUBLISHED HACKATHONS ERROR:", error);
    res.status(500).json({ message: "Server error while fetching published hackathons" });
  }
};

const updateHackathon = async (req, res) => {
  try {
    const hackathon = await getOwnedHackathon(req, res);
    if (!hackathon) return;

    const body = req.body || {};
    const allowedFields = [
      "title",
      "description",
      "eligibility",
      "registrationDeadline",
      "startDate",
      "endDate",
      "prizes",
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    const validationError = validateHackathon({
      title: updates.title ?? hackathon.title,
      description: updates.description ?? hackathon.description,
      eligibility: updates.eligibility ?? hackathon.eligibility,
      registrationDeadline:
        updates.registrationDeadline ?? hackathon.registrationDeadline,
      startDate: updates.startDate ?? hackathon.startDate,
      endDate: updates.endDate ?? hackathon.endDate,
      prizes: updates.prizes ?? hackathon.prizes,
    });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    Object.assign(hackathon, updates);
    await hackathon.save();
    res.status(200).json({ hackathon });
  } catch (error) {
    console.error("UPDATE HACKATHON ERROR:", error);
    res.status(500).json({ message: "Server error while updating hackathon" });
  }
};

const publishHackathon = async (req, res) => {
  try {
    const hackathon = await getOwnedHackathon(req, res);
    if (!hackathon) return;
    if (new Date(hackathon.registrationDeadline) <= new Date()) {
      return res.status(400).json({
        message: "Registration deadline must be in the future to publish",
      });
    }
    hackathon.published = true;
    await hackathon.save();
    res.status(200).json({ message: "Hackathon published", hackathon });
  } catch (error) {
    console.error("PUBLISH HACKATHON ERROR:", error);
    res.status(500).json({ message: "Server error while publishing hackathon" });
  }
};

const updateStage = async (req, res) => {
  try {
    const { stage } = req.body || {};
    if (!["registration", "judging", "completed"].includes(stage)) {
      return res.status(400).json({ message: "Choose a valid hackathon stage" });
    }
    const hackathon = await getOwnedHackathon(req, res);
    if (!hackathon) return;
    hackathon.stage = stage;
    await hackathon.save();
    res.status(200).json({ hackathon });
  } catch (error) {
    console.error("UPDATE HACKATHON STAGE ERROR:", error);
    res.status(500).json({ message: "Server error while updating hackathon stage" });
  }
};

const updateResults = async (req, res) => {
  try {
    const { results, published } = req.body || {};
    if (
      !Array.isArray(results) ||
      results.length > 20 ||
      typeof published !== "boolean" ||
      results.some(
        (result) =>
          !result ||
          typeof result.place !== "string" ||
          !result.place.trim() ||
          result.place.trim().length > 40 ||
          typeof result.teamName !== "string" ||
          !result.teamName.trim() ||
          result.teamName.trim().length > 120 ||
          (result.projectName !== undefined &&
            (typeof result.projectName !== "string" ||
              result.projectName.length > 120)) ||
          (result.description !== undefined &&
            (typeof result.description !== "string" ||
              result.description.length > 500))
      )
    ) {
      return res.status(400).json({ message: "Enter valid hackathon results" });
    }
    if (published && results.length === 0) {
      return res.status(400).json({ message: "Add at least one result before publishing" });
    }

    const hackathon = await getOwnedHackathon(req, res);
    if (!hackathon) return;
    if (published && (!hackathon.published || hackathon.stage !== "completed")) {
      return res.status(400).json({
        message: "Complete the published hackathon before publishing results",
      });
    }
    hackathon.results = results.map((result) => ({
      place: result.place.trim(),
      teamName: result.teamName.trim(),
      projectName: (result.projectName || "").trim(),
      description: (result.description || "").trim(),
    }));
    hackathon.resultsPublished = published;
    await hackathon.save();
    res.status(200).json({ message: "Hackathon results updated", hackathon });
  } catch (error) {
    console.error("UPDATE HACKATHON RESULTS ERROR:", error);
    res.status(500).json({ message: "Server error while updating results" });
  }
};

const getRegistrations = async (req, res) => {
  try {
    const hackathon = await getOwnedHackathon(req, res);
    if (!hackathon) return;
    await hackathon.populate([
      { path: "registrations.student", select: "name email" },
      { path: "registrations.team", select: "name" },
    ]);
    res.status(200).json({ registrations: hackathon.registrations });
  } catch (error) {
    console.error("GET HACKATHON REGISTRATIONS ERROR:", error);
    res.status(500).json({ message: "Server error while fetching registrations" });
  }
};

const updateRegistrationStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["pending", "accepted", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Choose a valid registration status" });
    }
    const hackathon = await getOwnedHackathon(req, res);
    if (!hackathon) return;
    const registration = hackathon.registrations.id(req.params.registrationId);
    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }
    registration.status = status;
    await hackathon.save();
    res.status(200).json({ registration });
  } catch (error) {
    console.error("UPDATE REGISTRATION STATUS ERROR:", error);
    res.status(500).json({ message: "Server error while updating registration" });
  }
};

module.exports = {
  listPublishedHackathons,
  updateHackathon,
  publishHackathon,
  updateStage,
  updateResults,
  getRegistrations,
  updateRegistrationStatus,
};
