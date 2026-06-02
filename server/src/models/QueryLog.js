import mongoose from 'mongoose';

const queryLogSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    confidence: { type: Number, required: true },
    answerFound: { type: Boolean, required: true },
    escalated: { type: Boolean, default: false }
  },
  { timestamps: true }
);

queryLogSchema.index({ createdAt: -1 });

export const QueryLog = mongoose.model('QueryLog', queryLogSchema);
