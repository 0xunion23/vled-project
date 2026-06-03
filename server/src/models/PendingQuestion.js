import mongoose from "mongoose";

const pendingQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true
    },
    embedding: {
      type: [Number],
      default: []
    },
    status: {
      type: String,
      default: "pending"
    }
  },
  { timestamps: true }
);

export const PendingQuestion = mongoose.model(
  "PendingQuestion",
  pendingQuestionSchema
);