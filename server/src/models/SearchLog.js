import mongoose from "mongoose";

const searchLogSchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model(
  "SearchLog",
  searchLogSchema
);