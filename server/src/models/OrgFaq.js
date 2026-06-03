import mongoose from 'mongoose';

const orgFaqSchema = new mongoose.Schema(
  {
    orgId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Organisation',
      required: true,
      index:    true,
    },
    question:  { type: String, required: true, trim: true },
    answer:    { type: String, required: true, trim: true },
    category:  { type: String, default: 'General', trim: true },
    tags:      { type: [String], default: [] },
    embedding: { type: [Number], default: [] },
    isActive:  { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const OrgFaq = mongoose.model('OrgFaq', orgFaqSchema);
