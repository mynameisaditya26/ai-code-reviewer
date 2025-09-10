import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  filename: String,
  language: String,
  code: String,
  reviewText: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Review", reviewSchema);
