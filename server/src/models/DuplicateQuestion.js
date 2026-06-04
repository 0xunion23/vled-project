import mongoose from 'mongoose';

const duplicateQuestionSchema = new mongoose.Schema(
  {
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