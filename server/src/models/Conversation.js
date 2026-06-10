import mongoose from 'mongoose';

const conversationMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    text: {
      type: String,
      required: true
    },
    answerFound: {
      type: Boolean,
      default: null
    },
    confidence: {
      type: Number,
      default: null
    },
    sources: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    escalationEligible: {
      type: Boolean,
      default: false
    },
    escalationStatus: {
      type: String,
      enum: ['pending', 'escalated', null],
      default: null
    },
    escalationQuery: {
      type: String,
      default: ''
    },
    memoryEligible: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: true
  }
);

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true
    },
    messages: {
      type: [conversationMessageSchema],
      default: []
    },
    archivedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

conversationSchema.index({ userId: 1, status: 1, updatedAt: -1 });

export default mongoose.model('Conversation', conversationSchema);
