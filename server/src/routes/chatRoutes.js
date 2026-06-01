import express from 'express';
import { answerQuestion } from '../services/ragService.js';

export const chatRouter = express.Router();

chatRouter.post('/', async (req, res, next) => {
  try {
    const result = await answerQuestion(req.body?.message);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
