import express from 'express';
import { answerQuestion } from '../services/ragService.js';
import { safetyScanner } from '../middleware/safetyScanner.js';
import { requireAuth, dailyRateLimit } from '../middleware/authMiddleware.js';
import SearchLog from '../models/SearchLog.js';

export const chatRouter = express.Router();

// POST /api/chat
// Auth → rate limit → safety scan → RAG pipeline
chatRouter.post('/', requireAuth, dailyRateLimit, safetyScanner, async (req, res, next) => {
  try {
    const message = req.body?.message;

    await SearchLog.create({ query: message });

    const result = await answerQuestion(message);

    // Include queries remaining in response so frontend can update the counter
    res.json({ ...result, queriesRemaining: req.queriesRemaining });
  } catch (error) {
    next(error);
  }
});
