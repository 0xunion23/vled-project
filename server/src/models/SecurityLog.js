import mongoose from 'mongoose';

const securityLogSchema = new mongoose.Schema(
  {
    payload: {
      type: String,
      required: true
    },
    threatLevel: {
      type: String,
      default: 'High'
    },
    blockedReason: {
      type: String,
      default: 'Prompt injection attempt detected'
    },
    detectedPattern: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

export const SecurityLog = mongoose.model('SecurityLog', securityLogSchema);
