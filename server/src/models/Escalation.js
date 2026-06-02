import mongoose from 'mongoose';

const escalationSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    confidence: { type: Number, required: true },
    sources: { type: Array, default: [] },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    adminAnswer: { type: String, default: '' },
    resolvedAt: { type: Date },
    sessionId: { type: String, trim: true }
  },
  { timestamps: true }
);

escalationSchema.index({ status: 1, createdAt: -1 });
escalationSchema.index({ sessionId: 1 });

export const Escalation = mongoose.model('Escalation', escalationSchema);
