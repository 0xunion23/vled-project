import mongoose from 'mongoose';

const organisationSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    domain:      { type: String, required: true, trim: true },
    tone: {
      type:    String,
      enum:    ['friendly', 'formal', 'technical', 'casual'],
      default: 'friendly',
    },
  },
  { timestamps: true }
);

export const Organisation = mongoose.model('Organisation', organisationSchema);
