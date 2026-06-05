import express from 'express';
import { answerQuestion } from '../services/ragService.js';
import { moderateMessage, BLOCK_MESSAGES } from '../services/moderationService.js';
import SearchLog from '../models/SearchLog.js';

export const chatRouter = express.Router();

chatRouter.post('/', async (req, res, next) => {
  try {
    const message = req.body?.message;

    // ── Content moderation (runs before anything else) ──────────────────────
    const moderation = await moderateMessage(message);
    if (!moderation.allowed) {
      return res.status(400).json({
        answer:      BLOCK_MESSAGES[moderation.reason] || BLOCK_MESSAGES.unsafe_content,
        answerFound: false,
        confidence:  0,
        sources:     [],
        blocked:     true,
        reason:      moderation.reason,
      });
    }

    // Save search
    await SearchLog.create({
      query: message
    });

    const result = await answerQuestion(message);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
