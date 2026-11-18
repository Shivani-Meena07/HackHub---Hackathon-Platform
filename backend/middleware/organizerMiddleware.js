const requireOrganizer = (req, res, next) => {
  if (!req.user || !["organizer", "admin"].includes(req.user.role)) {
    return res.status(403).json({
      message: "An organizer account is required to manage hackathons",
    });
  }
  next();
};

module.exports = { requireOrganizer };
