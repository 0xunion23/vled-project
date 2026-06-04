import mongoose from 'mongoose';

const mostAskedQuestionSchema = new mongoose.Schema(
  {
    normalizedQuestion: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    displayQuestion: {
      type: String,
      required: true,
      trim: true
    },

    count: {
      type: Number,
      default: 1
    },

    embedding: {
     type: [Number],
     default: []
}
  },
  {
    timestamps: true
  }
);

export default mongoose.model(
  'MostAskedQuestion',
  mostAskedQuestionSchema
);
