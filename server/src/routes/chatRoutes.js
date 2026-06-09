import express from 'express';
import { answerQuestion } from '../services/ragService.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { safetyScanner } from '../middleware/safetyScanner.js';
import SearchLog from '../models/SearchLog.js';

export const chatRouter = express.Router();

chatRouter.post('/', requireAuth, safetyScanner, async (req, res, next) => {
  try {
    const message = req.body?.message;

    await SearchLog.create({
      query: message
    });

    const result = await answerQuestion(message);

    res.json(result);
  } catch (error) {
    next(error);
  }
});
