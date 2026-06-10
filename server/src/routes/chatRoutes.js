import express from 'express';
import { answerQuestion } from '../services/ragService.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { safetyScanner } from '../middleware/safetyScanner.js';
import SearchLog from '../models/SearchLog.js';

export const chatRouter = express.Router();

chatRouter.post('/', requireAuth, safetyScanner, async (req, res, next) => {
  try {
    const message = req.body?.message;

    // history is an array of { role: 'user'|'assistant', text: string }
    // sent by the frontend to give Ollama conversational context.
    // Validated and capped to avoid prompt bloat.
    const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const history = rawHistory
      .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
      .slice(-10); // hard cap: last 10 messages max

    await SearchLog.create({ query: message });

    const result = await answerQuestion(message, history);

    res.json(result);
  } catch (error) {
    next(error);
  }
});
