import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true
    },
    answer: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      default: 'General',
      trim: true
    },
    tags: {
      type: [String],
      default: []
    },
    sourceId: {
      type: String,
      trim: true
    },
    sourceUrl: {
      type: String,
      trim: true
    },
    embedding: {
      type: [Number],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

faqSchema.index({ question: 'text', answer: 'text', category: 'text', tags: 'text' });
faqSchema.index({ sourceId: 1 }, { unique: true, sparse: true });

export const Faq = mongoose.model('Faq', faqSchema);
