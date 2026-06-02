import express from 'express';
import { Escalation } from '../models/Escalation.js';
import { answerQuestion } from '../services/ragService.js';

export const chatRouter = express.Router();

chatRouter.post('/', async (req, res, next) => {
  try {
    const result = await answerQuestion(req.body?.message, req.body?.sessionId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/chat/notifications/:sessionId
// User polls to check if escalated questions have been answered by admin
chatRouter.get('/notifications/:sessionId', async (req, res, next) => {
  try {
    const answered = await Escalation.find({
      sessionId: req.params.sessionId,
      status: 'resolved',
      adminAnswer: { $ne: '' }
    })
      .sort({ resolvedAt: -1 })
      .lean();
    res.json(answered);
  } catch (error) {
    next(error);
  }
});
