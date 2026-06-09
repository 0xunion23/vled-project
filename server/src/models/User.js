import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 32
    },
    passwordHash: {
      type: String,
      required: true
    },
    // Daily query rate limiting
    dailyQueryCount: {
      type: Number,
      default: 0
    },
    dailyQueryResetAt: {
      type: Date,
      default: () => new Date()
    }
  },
  { timestamps: true }
);

// Returns true if user has queries remaining today
userSchema.methods.canQuery = function () {
  const now = new Date();
  const lastReset = new Date(this.dailyQueryResetAt);

  // Check if we're in a new calendar day (UTC)
  const isNewDay =
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate();

  if (isNewDay) return true; // count will be reset before checking
  return this.dailyQueryCount < 20;
};

// Returns queries remaining today (resets if new day)
userSchema.methods.queriesRemaining = function () {
  const now = new Date();
  const lastReset = new Date(this.dailyQueryResetAt);
  const isNewDay =
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate();

  if (isNewDay) return 20;
  return Math.max(0, 20 - this.dailyQueryCount);
};

export const User = mongoose.model('User', userSchema);
