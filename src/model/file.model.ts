import mongoose from "mongoose";

const FileSchema = new mongoose.Schema({
  originalName: String,
  userId: String,
  status: {
    type: String,
    enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
    default: "PENDING",
  },
  mimeType: String,
  size: Number,
  s3Key: String,
  versions: {
    thumbnail: String,
    medium: String,
    optimized: String,
  },
  processingTimeMs: Number,
  error: String,
  createdAt: { type: Date, default: Date.now },
});
