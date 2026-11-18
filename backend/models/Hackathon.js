const mongoose = require("mongoose");

const prizeSchema = new mongoose.Schema(
  {
    place: { type: String, required: true, trim: true, maxlength: 40 },
    description: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { _id: false }
);

const registrationSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    teamName: { type: String, trim: true, maxlength: 120 },
    projectName: { type: String, trim: true, maxlength: 120 },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const resultSchema = new mongoose.Schema(
  {
    place: { type: String, required: true, trim: true, maxlength: 40 },
    teamName: { type: String, required: true, trim: true, maxlength: 120 },
    projectName: { type: String, trim: true, maxlength: 120, default: "" },
    description: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { _id: false }
);

const hackathonSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    eligibility: { type: String, required: true, trim: true, maxlength: 2000 },
    registrationDeadline: { type: Date, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    prizes: { type: [prizeSchema], required: true },
    published: { type: Boolean, default: false },
    stage: {
      type: String,
      enum: ["registration", "judging", "completed"],
      default: "registration",
    },
    registrations: { type: [registrationSchema], default: [] },
    results: { type: [resultSchema], default: [] },
    resultsPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Hackathon", hackathonSchema);
