import mongoose from 'mongoose';

const duplicateQuestionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    question: {
      type: String,
      required: true
    },
    matchedQuestion: {
      type: String
    },
    similarityScore: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['duplicate', 'new'],
      default: 'new'
    }
  },
  { timestamps: true }
);

export const DuplicateQuestion = mongoose.model(
  'DuplicateQuestion',
  duplicateQuestionSchema
);
