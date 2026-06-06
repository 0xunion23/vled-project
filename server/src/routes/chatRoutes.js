import express from 'express';
import { answerQuestion } from '../services/ragService.js';
import SearchLog from '../models/SearchLog.js';
export const chatRouter = express.Router();

chatRouter.post('/', async (req, res, next) => {
  try {
    const message = req.body?.message;
    

// Save search
await SearchLog.create({
  query: message
});

const result = await answerQuestion(message);
    res.json(result);
  } catch (error) {
  console.error("CHAT ERROR:", error);

  res.status(500).json({
    error: error.message,
    stack: error.stack
  });
}
});
