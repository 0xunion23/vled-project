import mongoose from 'mongoose';

const escalationSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true
    },
    confidence: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      default: 'pending'
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('Escalation', escalationSchema);