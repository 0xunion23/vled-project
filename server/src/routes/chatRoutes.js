import express from 'express';
import { answerQuestion } from '../services/ragService.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { safetyScanner } from '../middleware/safetyScanner.js';
import {
  appendConversationTurn,
  getConversationHistory,
  getRecentMemoryQueries,
  resetConversation
} from '../services/conversationService.js';
import SearchLog from '../models/SearchLog.js';

export const chatRouter = express.Router();

chatRouter.get('/history', requireAuth, async (req, res, next) => {
  try {
    const messages = await getConversationHistory(req.user);
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

chatRouter.post('/reset', requireAuth, async (req, res, next) => {
  try {
    await resetConversation(req.user);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

chatRouter.post('/', requireAuth, safetyScanner, async (req, res, next) => {
  try {
    const message = req.body?.message;

    await SearchLog.create({
      query: message
    });

    const memoryQueries = await getRecentMemoryQueries(req.user);
    const result = await answerQuestion(message, { memoryQueries });

    await appendConversationTurn(req.user, {
      query: message,
      result,
      memoryEligible: result.memoryEligible === true
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});
