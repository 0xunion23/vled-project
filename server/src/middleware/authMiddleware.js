import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

// requireAuth — verifies JWT, attaches req.user, rejects unauthenticated requests
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required. Please log in.' });
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// dailyRateLimit — enforces 20 queries per user per calendar day (UTC)
// Must be used AFTER requireAuth so req.user is available
export const dailyRateLimit = async (req, res, next) => {
  try {
    const user = req.user;
    const now = new Date();
    const lastReset = new Date(user.dailyQueryResetAt);

    // Check if we're in a new calendar day (UTC)
    const isNewDay =
      now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
      now.getUTCMonth() !== lastReset.getUTCMonth() ||
      now.getUTCDate() !== lastReset.getUTCDate();

    if (isNewDay) {
      // Reset counter for new day
      user.dailyQueryCount = 1;
      user.dailyQueryResetAt = now;
      await user.save();
      req.queriesRemaining = 19;
      return next();
    }

    if (user.dailyQueryCount >= 20) {
      // Calculate when the limit resets (midnight UTC)
      const resetTime = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1
      ));
      const hoursUntilReset = Math.ceil((resetTime - now) / 3600000);

      return res.status(429).json({
        message: `Daily query limit reached. You have used all 20 queries for today. Limit resets in ${hoursUntilReset} hour${hoursUntilReset !== 1 ? 's' : ''}.`,
        queriesRemaining: 0,
        limitReached: true
      });
    }

    user.dailyQueryCount += 1;
    await user.save();
    req.queriesRemaining = 20 - user.dailyQueryCount;
    next();
  } catch (error) {
    next(error);
  }
};
