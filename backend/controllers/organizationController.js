const Organization = require("../models/Organization.js");
const Hackathon = require("../models/Hackathon.js");

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isHttpUrl = (value) => {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const validateOrganization = (body) => {
  if (!body || typeof body !== "object") {
    return "Organization details are required";
  }
  const { name, description, website = "", contactEmail } = body;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 120 ||
    typeof description !== "string" ||
    !description.trim() ||
    description.trim().length > 2000 ||
    typeof contactEmail !== "string" ||
    !isEmail(contactEmail.trim()) ||
    typeof website !== "string" ||
    website.length > 300 ||
    !isHttpUrl(website.trim())
  ) {
    return "Enter a valid organization name, description, contact email, and website";
  }
  return null;
};

const validateHackathon = (body) => {
  if (!body || typeof body !== "object") {
    return "Hackathon details are required";
  }
  const {
    title,
    description,
    eligibility,
    registrationDeadline,
    startDate,
    endDate,
    prizes,
  } = body;
  const deadline = new Date(registrationDeadline);
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 120 ||
    typeof description !== "string" ||
    !description.trim() ||
    description.trim().length > 5000 ||
    typeof eligibility !== "string" ||
    !eligibility.trim() ||
    eligibility.trim().length > 2000 ||
    !Number.isFinite(deadline.getTime()) ||
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    deadline > start ||
    start >= end ||
    !Array.isArray(prizes) ||
    prizes.length === 0 ||
    prizes.length > 20 ||
    prizes.some(
      (prize) =>
        !prize ||
        typeof prize.place !== "string" ||
        !prize.place.trim() ||
        prize.place.trim().length > 40 ||
        typeof prize.description !== "string" ||
        !prize.description.trim() ||
        prize.description.trim().length > 300
    )
  ) {
    return "Provide complete hackathon details, valid deadlines, and at least one valid prize";
  }
  return null;
};

const createOrganization = async (req, res) => {
  try {
    const validationError = validateOrganization(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const organization = await Organization.create({
      name: req.body.name.trim(),
      description: req.body.description.trim(),
      website: req.body.website.trim(),
      contactEmail: req.body.contactEmail.trim().toLowerCase(),
      owner: req.user._id,
    });
    res.status(201).json({ organization });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Your account already has an organization profile",
      });
    }
    console.error("CREATE ORGANIZATION ERROR:", error);
    res.status(500).json({ message: "Server error while creating organization" });
  }
};

const getMyOrganization = async (req, res) => {
  try {
    const organization = await Organization.findOne({ owner: req.user._id });
    if (!organization) {
      return res.status(404).json({ message: "Create your organization profile to continue" });
    }
    res.status(200).json({ organization });
  } catch (error) {
    console.error("GET ORGANIZATION ERROR:", error);
    res.status(500).json({ message: "Server error while fetching organization" });
  }
};

const updateOrganization = async (req, res) => {
  try {
    const validationError = validateOrganization(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    const organization = await Organization.findOneAndUpdate(
      { owner: req.user._id },
      {
        $set: {
          name: req.body.name.trim(),
          description: req.body.description.trim(),
          website: req.body.website.trim(),
          contactEmail: req.body.contactEmail.trim().toLowerCase(),
        },
      },
      { new: true, runValidators: true }
    );
    if (!organization) {
      return res.status(404).json({ message: "Organization profile not found" });
    }
    res.status(200).json({ organization });
  } catch (error) {
    console.error("UPDATE ORGANIZATION ERROR:", error);
    res.status(500).json({ message: "Server error while updating organization" });
  }
};

const createHackathon = async (req, res) => {
  try {
    const validationError = validateHackathon(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    const organization = await Organization.findOne({ owner: req.user._id });
    if (!organization) {
      return res.status(404).json({ message: "Create your organization profile first" });
    }
    const hackathon = await Hackathon.create({
      organization: organization._id,
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      eligibility: req.body.eligibility.trim(),
      registrationDeadline: req.body.registrationDeadline,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      prizes: req.body.prizes.map((prize) => ({
        place: prize.place.trim(),
        description: prize.description.trim(),
      })),
    });
    res.status(201).json({ hackathon });
  } catch (error) {
    console.error("CREATE HACKATHON ERROR:", error);
    res.status(500).json({ message: "Server error while creating hackathon" });
  }
};

const getMyHackathons = async (req, res) => {
  try {
    const organization = await Organization.findOne({ owner: req.user._id });
    if (!organization) {
      return res.status(404).json({ message: "Create your organization profile first" });
    }
    const hackathons = await Hackathon.find({
      organization: organization._id,
    }).sort({ createdAt: -1 });
    res.status(200).json({ hackathons });
  } catch (error) {
    console.error("GET ORGANIZATION HACKATHONS ERROR:", error);
    res.status(500).json({ message: "Server error while fetching hackathons" });
  }
};

module.exports = {
  createOrganization,
  getMyOrganization,
  updateOrganization,
  createHackathon,
  getMyHackathons,
  validateHackathon,
};
